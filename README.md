# QuickBite - Food Delivery Web Application

A simple food delivery web application built with Node.js, Express, PostgreSQL, and vanilla HTML/CSS/JS.

## Features

### User Features

- Landing page with featured food items
- User registration and login (session-based)
- View food menu
- Add items to cart
- Place orders
- Logout

### Admin Features

- Admin login (username: admin, password: admin123)
- Add new food items
- View all orders

## Prerequisites

1. Node.js installed
2. PostgreSQL installed and running

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Create PostgreSQL Database

```bash
# Open PostgreSQL terminal
psql -U postgres

# Create database
CREATE DATABASE quickbite;

# Exit psql and run the SQL script
\i database.sql
```

Or manually run the SQL commands from `database.sql`

### 3. Configure Database Connection

Edit `server.js` and update the Pool configuration if your PostgreSQL credentials are different:

```javascript
const pool = new Pool({
  user: "postgres", // Your PostgreSQL username
  host: "localhost",
  database: "quickbite",
  password: "postgres", // Your PostgreSQL password
  port: 5432,
});
```

### 4. Start the Server

```bash
npm start
```

### 5. Access the Application

Open your browser and go to: http://localhost:3000

## Project Structure

```
QuickBite/
├── public/
│   ├── index.html      # Landing page
│   ├── login.html      # Login page
│   ├── register.html   # Registration page
│   ├── menu.html       # Menu with cart
│   ├── admin.html      # Admin dashboard
│   ├── styles.css      # Styling
│   └── script.js       # Client-side JavaScript
├── server.js           # Express server
├── package.json        # Dependencies
├── database.sql        # Database setup
└── README.md           # This file
```

## Default Admin Credentials

- Username: admin
- Password: admin123

## API Endpoints

| Method | Endpoint          | Description            |
| ------ | ----------------- | ---------------------- |
| POST   | /api/register     | Register new user      |
| POST   | /api/login        | User login             |
| POST   | /api/logout       | User logout            |
| GET    | /api/session      | Check session          |
| GET    | /api/menu         | Get food menu          |
| POST   | /api/order        | Place order            |
| GET    | /api/orders       | Get user orders        |
| POST   | /api/admin/login  | Admin login            |
| POST   | /api/admin/food   | Add food item (admin)  |
| GET    | /api/admin/orders | Get all orders (admin) |

## License

MIT
