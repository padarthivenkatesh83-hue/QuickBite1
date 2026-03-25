require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration - MUST be before static file serving
app.use(session({
    secret: 'quickbite_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 } // 1 hour
}));

// Static files after session
app.use(express.static(path.join(__dirname, 'public')));

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'quickbite',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432
});

// Initialize database tables
async function initDatabase() {
    try {
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL
            )
        `);

        // Create food table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS food (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                image VARCHAR(255)
            )
        `);

        // Create orders table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                food_name VARCHAR(100) NOT NULL,
                quantity INTEGER DEFAULT 1,
                total_price DECIMAL(10,2),
                delivery_address TEXT,
                payment_method VARCHAR(50),
                status VARCHAR(50) DEFAULT 'Pending',
                date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add status column if it doesn't exist (for existing tables)
        try {
            await pool.query(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending'
            `);
        } catch (err) {
            // Column might already exist, ignore error
        }

        // Add delivery_address column if it doesn't exist (for existing tables)
        try {
            await pool.query(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT
            `);
        } catch (err) {
            // Column might already exist, ignore error
        }

        // Add payment_method column if it doesn't exist (for existing tables)
        try {
            await pool.query(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)
            `);
        } catch (err) {
            // Column might already exist, ignore error
        }

        // Insert sample food items if empty
        const foodCount = await pool.query('SELECT COUNT(*) FROM food');
        if (parseInt(foodCount.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO food (name, price, image) VALUES
                ('Pizza Margherita', 299, 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=300'),
                ('Burger Deluxe', 199, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300'),
                ('Chicken Biryani', 249, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300'),
                ('Pasta Carbonara', 279, 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=300'),
                ('Fried Rice', 189, 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=300')
            `);
            console.log('Sample food items added');
        }

        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err.message);
    }
}

initDatabase();

// Routes

// API Routes FIRST (before static file serving)

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Register user
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Check if user exists
        const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const result = await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
            [name, email, hashedPassword]
        );

        res.json({ success: true, message: 'Registration successful', user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Login user
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid email or password' });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid email or password' });
        }

        // Set session
        req.session.userId = user.id;
        req.session.userName = user.name;
        req.session.userEmail = user.email;

        res.json({ success: true, message: 'Login successful', user: { name: user.name, email: user.email } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out successfully' });
});

// Check session
app.get('/api/session', (req, res) => {
    if (req.session.userId) {
        res.json({ 
            loggedIn: true, 
            user: { 
                name: req.session.userName, 
                email: req.session.userEmail,
                isAdmin: req.session.admin || false
            },
            isAdmin: req.session.admin || false
        });
    } else if (req.session.admin) {
        res.json({ 
            loggedIn: false,
            isAdmin: true,
            user: { isAdmin: true }
        });
    } else {
        res.json({ loggedIn: false, isAdmin: false });
    }
});

// Get menu
app.get('/api/menu', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM food');
        res.json({ success: true, menu: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Place order
app.post('/api/order', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'Please login to place order' });
        }

        const { items, deliveryAddress, paymentMethod, total } = req.body;
        
        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        // Get the last order ID for reference
        let orderId = null;
        
        // Insert each item as a separate order
        for (const item of items) {
            const quantity = item.quantity || 1;
            const totalPrice = item.price * quantity;
            const result = await pool.query(
                'INSERT INTO orders (user_id, food_name, quantity, total_price, delivery_address, payment_method, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
                [req.session.userId, item.name, quantity, totalPrice, deliveryAddress, paymentMethod, 'Pending']
            );
            if (!orderId) orderId = result.rows[0].id;
        }

        res.json({ success: true, message: 'Order placed successfully!', orderId: orderId });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get user orders
app.get('/api/orders', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'Please login' });
        }

        const result = await pool.query(
            'SELECT * FROM orders WHERE user_id = $1 ORDER BY date DESC',
            [req.session.userId]
        );

        res.json({ success: true, orders: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Cancel order (user can only cancel if status is Pending)
app.post('/api/order/cancel', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'Please login' });
        }

        const { orderId } = req.body;
        
        if (!orderId) {
            return res.status(400).json({ success: false, message: 'Order ID is required' });
        }

        // Check if order exists and belongs to user and is still Pending
        const orderCheck = await pool.query(
            'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
            [orderId, req.session.userId]
        );

        if (orderCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (orderCheck.rows[0].status !== 'Pending') {
            return res.status(400).json({ success: false, message: 'Only pending orders can be cancelled' });
        }

        // Update order status to Cancelled
        await pool.query(
            'UPDATE orders SET status = $1 WHERE id = $2',
            ['Cancelled', orderId]
        );

        res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get all orders for admin
app.get('/api/admin/orders', async (req, res) => {
    try {
        if (!req.session || !req.session.admin) {
            console.log('Admin session check failed:', req.session);
            return res.status(401).json({ success: false, message: 'Admin access required' });
        }

        const result = await pool.query(
            `SELECT o.*, u.name as user_name, u.email as user_email 
             FROM orders o 
             LEFT JOIN users u ON o.user_id = u.id 
             ORDER BY o.date DESC`
        );

        console.log('Admin orders query result:', result.rows.length);
        res.json({ success: true, orders: result.rows });
    } catch (err) {
        console.error('Error fetching admin orders:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update order status
app.post('/api/admin/order/status', async (req, res) => {
    try {
        console.log('Update order status request:', req.body);
        console.log('Session admin:', req.session?.admin);
        
        if (!req.session || !req.session.admin) {
            return res.status(401).json({ success: false, message: 'Admin access required' });
        }

        const { orderId, status } = req.body;
        
        console.log('Updating order:', orderId, 'to status:', status);

        const result = await pool.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status',
            [status, orderId]
        );
        
        console.log('Update result:', result);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.json({ success: true, message: 'Order status updated' });
    } catch (err) {
        console.error('Error updating order status:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Admin login (simple hardcoded check)
app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    // Hardcoded admin credentials
    if (username === 'admin' && password === 'admin123') {
        req.session.admin = true;
        res.json({ success: true, message: 'Admin login successful' });
    } else {
        res.status(400).json({ success: false, message: 'Invalid admin credentials' });
    }
});

// Admin add food item
app.post('/api/admin/food', async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.status(401).json({ success: false, message: 'Admin access required' });
        }

        const { name, price, image } = req.body;
        
        if (!name || !price) {
            return res.status(400).json({ success: false, message: 'Name and price are required' });
        }

        await pool.query(
            'INSERT INTO food (name, price, image) VALUES ($1, $2, $3)',
            [name, price, image || '']
        );

        res.json({ success: true, message: 'Food item added successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});