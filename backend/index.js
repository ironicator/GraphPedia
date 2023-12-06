const express = require("express");
const {
  client,
  insertIntoTable,
  createTableQuery,
  getAllRows,
  DropTable,
  DeleteRowFromUsers,
} = require("./database");
const mongoose = require("mongoose");
const cors = require("cors");
const { spawn } = require("child_process");
const bodyParser = require("body-parser");
const pg = require("pg");
require("dotenv").config();
// var user = require("./routes/api/user");
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());

//app.use("/api/users", user);

// spawn new child process to call the python script
const python = spawn("python", ["./routes/DataFetching/data.py", "Youssef"]);

python.stdout.on("data", (data) => {
  console.log(data.toString());
});

client
  .connect()
  .then(() => console.log("Connected to PostgreSQL"))
  .catch((err) => console.log(err));

//   .connect()
//   .then(() => console.log("Connected to CockroachDB"))
//   .catch((err) => console.log(err));

createTableQuery();
insertIntoTable("('youssef', 24)");
getAllRows("Users");
DeleteRowFromUsers("WHERE name='youssef'");
getAllRows("Users");

mongoose
  .connect(
    "mongodb+srv://admin:admin@cluster0.ll6tz.mongodb.net/myFirstDatabase?retryWrites=true&w=majority",
    {
      useNewUrlParser: true,
      // useFindAndModify: false,
      // useCreateIndex: true,
      // useUnifiedTopology: true
    }
  )
  .then(() => console.log("Connected to mongoDB"))
  .catch((err) => console.log(err));

app.use((req, res) => {
  res.status(404).send({ err: "We can not find what you are looking for" });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server up and running on port ${port}`));
