const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");

// var user = require("./routes/api/user");

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());

//app.use("/api/users", user);

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
