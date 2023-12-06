const pg = require("pg");

// Local PG admin Client
const client = new pg.Client({
  host: "localhost",
  user: "postgres",
  port: 5555,
  password: "admin",
  database: "postgres",
});

//Cockroach DB Client
// const client = new pg.Client({
//   host: "yellow-shadow-8255.7tc.cockroachlabs.cloud",
//   user: "abuelleil",
//   port: 26257,
//   password: "lvBuhbfeW5RhYKXKmxnwkQ",
//   database: "postgres",
//   ssl: {
//     rejectUnauthorized: false,
//   },
// });

async function createTableQuery(req, res) {
  try {
    // client.connect();
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS Users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        age INT
      );
    `;

    await client.query(createTableQuery);
    console.log("Table created successfully");
    // return res.send({ data: result.rows });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    // await client.end();
    console.log("Connection closed");
  }
}

async function insertIntoTable(req, res) {
  try {
    // client.connect();
    const insertDataQuery = `INSERT INTO Users (name, age) VALUES ${req}`;
    await client.query(insertDataQuery);
    console.log("Rows Inserted successfully");
    const selectDataQuery = "SELECT * FROM Users";
    const result = await client.query(selectDataQuery);
    console.log("Query result:", result.rows);
    // return res.send({ data: result.rows });
  } catch (error) {
    console.error("Error:", error);
  }
  // finally {
  // await client.end();
  //   console.log("Connection closed");
  // }
}

async function getAllRows(req, res) {
  try {
    // client.connect();
    const Query = `SELECT * FROM Users `;
    const selectDataQuery = "SELECT * FROM Users";
    const result = await client.query(selectDataQuery);
    // return res.send({ data: result.rows });
  } catch (error) {
    console.error("Error:", error);
  }
  // finally {
  //   // await client.end();
  //   console.log("Connection closed");
  // }
}

async function getRow(req, res) {
  try {
    const Query = `SELECT * FROM Users where ${req} `;
    const result = await client.query(Query);
    console.log("Query result:", result.rows);
    // return res.send({ data: result.rows });
  } catch (error) {
    console.error("Error:", error);
  }
  // finally {
  //   await client.end();
  //   console.log("Connection closed");
  // }
}

async function DeleteRowFromUsers(req, res) {
  try {
    const Query = `Delete FROM Users ${req} `;
    await client.query(Query);
    const selectDataQuery = "SELECT * FROM Users";
    const result = await client.query(selectDataQuery);
    console.log("Remaining Data:", result.rows);
    // return res.send({ data: result.rows });
  } catch (error) {
    console.error("Error:", error);
  }
  // finally {
  //   await client.end();
  //   console.log("Connection closed");
  // }
}

async function DropTable(req, res) {
  try {
    const Query = `DROP TABLE ${req} `;
    const result = await client.query(Query);
    console.log("Query result:", result.rows);
    // return res.send({ data: result.rows });
  } catch (error) {
    console.error("Error:", error);
  }
  // finally {
  //   await client.end();
  //   console.log("Connection closed");
  // }
}

// client.query("select * from Users where name='Youssef'", (err, res) => {
//   if (!err) {
//     console.log(res.rows);
//   } else {
//     console.log(err.message);
//   }
//   client.end;
// });

// client.query("select now()", (err, res) => {
//   if (!err) {
//     console.log(res.rows);
//   } else {
//     console.log(err.message);
//   }
//   client.end;
// });

// module.exports = client;
module.exports = {
  client,
  insertIntoTable,
  createTableQuery,
  getAllRows,
  DropTable,
  DeleteRowFromUsers,
  getRow,
};
