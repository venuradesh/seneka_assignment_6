const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Schema = mongoose.Schema;

const userSchema = new Schema({
  userName: {
    type: String,
    unique: true,
  },
  password: String,
  email: String,
  loginHistory: [{ dateTime: Date, userAgent: String }],
});

let User;

module.exports.initialize = () => {
  return new Promise((resolve, reject) => {
    let db = mongoose.createConnection("mongodb+srv://tempuser:bDuwtvBaFZUgiWBz@cluster0.igvm6ld.mongodb.net/?retryWrites=true&w=majority");
    db.on("error", (err) => {
      reject(err);
    });
    db.once("open", () => {
      User = db.model("users", userSchema);
      resolve();
    });
  });
};

module.exports.registerUser = (userData) => {
  //userData => userName, userAgent, email, password, password2
  return new Promise((resolve, reject) => {
    if (userData.password !== userData.password2) {
      reject("Passwords do not match");
    }

    bcrypt
      .hash(userData.password, 10)
      .then((hash) => {
        userData.password = hash;
        let newUser = new User(userData);
        newUser
          .save()
          .then(() => {
            resolve();
          })
          .catch((err) => {
            if (err.code === 11000) {
              reject("User Name already taken");
            }

            reject(`There was an error creating the user: ${err}`);
          });
      })
      .catch((err) => {
        reject("There was an error encrypting the password");
      });
  });
};

module.exports.checkUser = (userData) => {
  return new Promise((resolve, reject) => {
    User.find({ userName: userData.userName })
      .exec()
      .then((users) => {
        if (users.length === 0) {
          reject(`Unable to find user: ${userData.userName}`);
        }

        bcrypt
          .compare(userData.password, users[0].password)
          .then((result) => {
            if (result === true) {
              users[0].loginHistory.push({ dateTime: new Date().toString(), userAgent: userData.userAgent });
              User.updateOne({ userName: users[0].userName }, { $set: { loginHistory: users[0].loginHistory } })
                .exec()
                .then(() => {
                  resolve(users[0]);
                })
                .catch((err) => {
                  reject(`There was an error verifying the user: ${err}`);
                });
            } else {
              reject(`Incorrect password for the user: ${userData.userName}`);
            }
          })
          .catch((err) => {
            console.log(err);
          });
      })
      .catch((err) => {
        reject(`Unable to find the user: ${userData.userName}`);
      });
  });
};
