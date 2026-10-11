# SINIS TSA Backend

Node.js, Express, MongoDB Atlas, and Mongoose backend for the SINIS TSA ordering, inventory, and sales management system.

## Setup

Install dependencies:

```sh
npm ci
```

Create a local `.env` based on:

```text
.env.example
```

Required environment variables:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string_here
```

Never commit the real `.env` file.

## Development

Start the development server:

```sh
npm run dev
```

Start without Nodemon:

```sh
npm start
```

The development API normally runs at:

```text
http://localhost:5000/api
```

The server must also be able to connect to MongoDB Atlas. Some networks may interfere with Atlas TLS connectivity even when the local Express port is available.

## Testing

Run the server syntax checks:

```sh
npm test
```

## Database Seed

Restore the demonstration database:

```sh
npm run seed -- --reset
```

Use the reset option only when intentionally restoring the demo data.

## Main Features

The backend provides APIs for:

- menu items and categories
- ingredients and recipes
- inventory and stock transactions
- order creation and status processing
- menu availability calculation
- sales and management analytics

## Frontend

The frontend is maintained separately in:

```text
https://github.com/franzdimalanta/sinis-tsa-client
```