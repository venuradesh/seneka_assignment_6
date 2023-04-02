const dataServiceAuth = require("./data-service.js");
const express = require("express");
const path = require("path");
const data = require("./data-service.js");
// const bodyParser = require('body-parser');
const fs = require("fs");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

const exphbs = require("express-handlebars");

const app = express();
const HTTP_PORT = process.env.PORT || 8080;

cloudinary.config({
  cloud_name: "Cloud Name",
  api_key: "API Key",
  api_secret: "API Secret",
  secure: true,
});

app.engine(
  ".hbs",
  exphbs.engine({
    extname: ".hbs",
    defaultLayout: "main",
    helpers: {
      navLink: function (url, options) {
        return "<li" + (url == app.locals.activeRoute ? ' class="active" ' : "") + '><a href="' + url + '">' + options.fn(this) + "</a></li>";
      },
      equal: function (lvalue, rvalue, options) {
        if (arguments.length < 3) throw new Error("Handlebars Helper equal needs 2 parameters");
        if (lvalue != rvalue) {
          return options.inverse(this);
        } else {
          return options.fn(this);
        }
      },
    },
  })
);

app.set("view engine", ".hbs");

// const upload = multer({ storage: storage });
const upload = multer(); // remove storage for using Cloudinary API

app.use(express.static("public"));
// app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));

app.use(function (req, res, next) {
  let route = req.baseUrl + req.path;
  app.locals.activeRoute = route == "/" ? "/" : route.replace(/\/$/, "");
  next();
});

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/about", (req, res) => {
  res.render("about");
});

// // routes for students

app.get("/students/add", (req, res) => {
  data
    .getPrograms()
    .then((data) => {
      res.render("addStudent", { programs: data });
    })
    .catch((err) => {
      // set program list to empty array
      res.render("addStudent", { programs: [] });
    });
});

app.post("/students/add", (req, res) => {
  data
    .addStudent(req.body)
    .then(() => {
      res.redirect("/students");
    })
    .catch((err) => {
      /// new in a5
      res.status(500).send("Unable to Add the Student");
    }); ///
});

app.get("/students", (req, res) => {
  if (req.query.status) {
    data
      .getStudentsByStatus(req.query.status)
      .then((data) => {
        res.render("students", { students: data });
      })
      .catch((err) => {
        res.render("students", { message: "no results" });
      });
  } else if (req.query.program) {
    data
      .getStudentsByProgramCode(req.query.program)
      .then((data) => {
        res.render("students", { students: data });
      })
      .catch((err) => {
        res.render("students", { message: "no results" });
      });
  } else if (req.query.credential) {
    data
      .getStudentsByExpectedCredential(req.query.credential)
      .then((data) => {
        res.render("students", { students: data });
      })
      .catch((err) => {
        res.render("students", { message: "no results" });
      });
  } else {
    data
      .getAllStudents()
      .then((data) => {
        res.render("students", { students: data });
      })
      .catch((err) => {
        res.render("students", { message: "no results" });
      });
  }
});

app.get("/student/:studentId", (req, res) => {
  // initialize an empty object to store the values
  let viewData = {};

  data
    .getStudentById(req.params.studentId)
    .then((data) => {
      if (data) {
        viewData.student = data; //store student data in the "viewData" object as "student"
      } else {
        viewData.student = null; // set student to null none were returned
      }
    })
    .catch(() => {
      viewData.student = null; // set student to null if there was an error
    })
    .then(data.getPrograms)
    .then((data) => {
      viewData.programs = data; // store program data in the "viewData" object as "programs"

      // loop through viewData.programs and once we have found the programCode that matches
      // the student's "program" value, add a "selected" property to the matching
      // viewData.programs object
      for (let i = 0; i < viewData.programs.length; i++) {
        if (viewData.programs[i].programCode == viewData.student.program) {
          viewData.programs[i].selected = true;
        }
      }
    })
    .catch(() => {
      viewData.programs = []; // set programs to empty if there was an error
    })
    .then(() => {
      if (viewData.student == null) {
        // if no student - return an error
        res.status(404).send("Student Not Found");
      } else {
        res.render("student", { viewData: viewData }); // render the "student" view
      }
    })
    .catch((err) => {
      res.status(500).send("Unable to Show Students");
    });
});

app.get("/intlstudents", (req, res) => {
  data.getInternationalStudents().then((data) => {
    res.json(data);
  });
});

app.post("/student/update", (req, res) => {
  data
    .updateStudent(req.body)
    .then(() => {
      res.redirect("/students");
    })
    .catch((err) => {
      /// new in a5
      res.status(500).send("Unable to Update the Student");
    });
});

app.get("/students/delete/:sid", (req, res) => {
  /// new in a5
  data
    .deleteStudentById(req.params.sid)
    .then(() => {
      res.redirect("/students");
    })
    .catch((err) => {
      res.status(500).send("Unable to Remove Student / Student Not Found");
    });
});

// routes for images:

app.get("/images/add", (req, res) => {
  res.render("addImage");
});

app.post("/images/add", upload.single("imageFile"), (req, res) => {
  if (req.file) {
    let streamUpload = (req) => {
      return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream((error, result) => {
          if (result) {
            resolve(result);
          } else {
            reject(error);
          }
        });

        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    async function upload(req) {
      let result = await streamUpload(req);
      return result;
    }

    upload(req).then((uploaded) => {
      processForm(uploaded); // processForm(uploaded.url); // a4
    });
  } else {
    processForm("");
  }

  function processForm(uploaded) {
    /// processForm(imageUrl) in a4

    imageData = {};
    imageData.imageID = uploaded.public_id;
    imageData.imageUrl = uploaded.url;
    imageData.version = uploaded.version;
    imageData.width = uploaded.width;
    imageData.height = uploaded.height;
    imageData.format = uploaded.format;
    imageData.resourceType = uploaded.resource_type;
    imageData.uploadedAt = uploaded.created_at;
    imageData.originalFileName = req.file.originalname;
    imageData.mimeType = req.file.mimetype;

    // TODO: Process the image url on Cloudinary before redirecting to /images
    data
      .addImage(imageData)
      .then(() => {
        res.redirect("/images");
      })
      .catch((err) => {
        res.status(500).send(err);
      });
  }

  // // for deploying to Cyclic
  // res.redirect("/images");
});

app.get("/images", (req, res) => {
  data
    .getImages()
    .then((data) => {
      res.render("images", { images: data });
    })
    .catch((err) => {
      res.render("images", { message: "no results" });
    });
});

// routes for programs:

app.get("/programs/add", (req, res) => {
  /// new in a5
  res.render("addProgram");
});

app.post("/programs/add", (req, res) => {
  /// new in a5
  data
    .addProgram(req.body)
    .then(() => {
      res.redirect("/programs");
    })
    .catch((err) => {
      res.status(500).send("Unable to Add the Program");
    });
});

app.get("/programs", (req, res) => {
  data
    .getPrograms()
    .then((data) => {
      res.render("programs", data.length > 0 ? { programs: data } : { message: "no results" });
    })
    .catch((err) => {
      res.render("programs", { message: "no results" });
    });
});

app.get("/program/:programCode", (req, res) => {
  /// new in a5
  data
    .getProgramByCode(req.params.programCode)
    .then((data) => {
      if (data) {
        res.render("program", { data: data });
      } else {
        res.status(404).send("Program Not Found");
      }
    })
    .catch((err) => {
      res.status(404).send("Program Not Found");
    });
});

app.post("/program/update", (req, res) => {
  /// new in a5
  data
    .updateProgram(req.body)
    .then(() => {
      res.redirect("/programs");
    })
    .catch((err) => {
      res.status(500).send("Unable to Update the Program");
    });
});

app.get("/programs/delete/:programCode", (req, res) => {
  /// new in a5
  data
    .deleteProgramByCode(req.params.programCode)
    .then(() => {
      res.redirect("/programs");
    })
    .catch((err) => {
      res.status(500).send("Unable to Remove Program / Program Not Found");
    });
});

app.use((req, res) => {
  res.status(404).send("Page Not Found");
});

data
  .initialize()
  .then(function () {
    app.listen(HTTP_PORT, function () {
      console.log("app listening on: " + HTTP_PORT);
    });
  })
  .catch(function (err) {
    console.log("unable to start server: " + err);
  });
