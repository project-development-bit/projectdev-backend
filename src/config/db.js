const dotenv = require("dotenv");
dotenv.config();
const mysql2 = require("mysql2");

class DBConnection {
  constructor(database) {
    
    console.log(`Connecting to ${database} database...`);
    console.log(`DB_${database}_URL`);

    if (process.env[`DB_${database}_URL`]) {
      this.db = mysql2.createPool(process.env[`DB_${database}_URL`] + '?timezone=Z');
    } else {
      this.db = mysql2.createPool({
        host: process.env[`DB_${database}_HOST`],
        user: process.env[`DB_${database}_USERNAME`],
        password: process.env[`DB_${database}_PASSWORD`],
        database: process.env[`DB_${database}_DATABASE`],
        timezone: 'Z', // Force UTC timezone
      });
    }

    this.checkConnection(database);
  }

  checkConnection(database) {
    this.db.getConnection((err, connection) => {
      if (err) {
        if (err.code === "PROTOCOL_CONNECTION_LOST") {
          console.error(`${database} Database connection was closed.`);
        }
        if (err.code === "ER_CON_COUNT_ERROR") {
          console.error(`${database} Database has too many connections.`);
        }
        if (err.code === "ECONNREFUSED") {
          console.error(`${database} Database connection was refused.`);
        }
      }
      if (connection) {
        connection.release();
      }
      return;
    });
  }

  query = async (sql, values) => {
    return new Promise((resolve, reject) => {
      const callback = (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      };
      this.db.execute(sql, values, callback);
    }).catch((err) => {
      const mysqlErrorList = Object.keys(HttpStatusCodes);
      err.status = mysqlErrorList.includes(err.code)
        ? HttpStatusCodes[err.code]
        : err.status;
      throw err;
    });
  };
}

const HttpStatusCodes = Object.freeze({
  ER_TRUNCATED_WRONG_VALUE_FOR_FIELD: 422,
  ER_DUP_ENTRY: 409,
});

// Create instances of DBConnection for each database
// const onlineServiceDB = new DBConnection("ONLINESERVICE");
// const datamartDB = new DBConnection("DATAMART");
// const JWDB = new DBConnection("JWDB");
const coinDB = new DBConnection("COIN");
// Add more instances for other databases as needed

module.exports = {
  // onlineServiceQuery: onlineServiceDB.query,
  // datamartQuery: datamartDB.query,
  // jwdbQuery: JWDB.query,
  coinQuery: coinDB.query,
  // Export more query functions for other databases if necessary
};
