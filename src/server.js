const express = require("express");
const dotenv = require('dotenv');
const cors = require("cors");
const HttpException = require('./utils/HttpException.utils.js');
// const errorMiddleware = require('./middleware/error.middleware.js/index.js');
const errorMiddleware = require('./middleware/error.middleware');
const host = process.env.HOST || 'localhost';

const userRouter = require('./routes/user.route');

// Init express
const app = express();
// Init environment
dotenv.config();
// parse requests of content-type: application/json
// parses incoming requests with JSON payloads
app.use(express.json());
// enabling cors for all requests by using cors middleware
app.use(cors());
// app.use(cors({
//     origin: ['https://api-services.lumahealth.com/'],
//   }));
// Enable pre-flight
// app.options("*", cors());
// test CI pipeline

const port = Number(process.env.PORT || 3500);

app.use(`/api/v1/users`, userRouter);

app.use((req, res, next) => {
  const err = new HttpException(404, 'Endpoint Not Found');
  next(err);
});

// Error middleware
app.use(errorMiddleware);

// starting the server
app.listen(port, host, () => {
  console.log(`🚀 Server running on http://${host}:${port}`);
});


module.exports = app;