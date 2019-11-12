const express = require('express');
const app = express();
const url = require('url');
const fs = require('fs');
const formidable = require('formidable');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const ObjectID = require('mongodb').ObjectID;
const mongourl = "mongodb://me:381lab@381-lab-shard-00-00-au1bm.azure.mongodb.net:27017,381-lab-shard-00-01-au1bm.azure.mongodb.net:27017,381-lab-shard-00-02-au1bm.azure.mongodb.net:27017/test?ssl=true&replicaSet=381-lab-shard-0&authSource=admin&retryWrites=true&w=majority";
const dbName = "test";

app.set('view engine', 'ejs');
app.get("/login", function (req, res) {
    if (req.query.create == 'success')
        msg = "Create Account successful";
    else if (req.query.login == 'fail')
        msg = "Incorrect User ID or Passward";
    else
        msg = "";
    res.render("login", { msg: msg });
});
app.get("/rate", function (req, res) {
    res.render("rate", { _id: req.query._id });
});
app.get("/change", function (req, res) {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err, null);
        } catch (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("MongoClient connect() failed!");
            return (-1);
        }
        const db = client.db(dbName);

        search_restaurant(db, req.query, (restaurant, temp) => {
            res.render("change", { restaurant: restaurant });

        });
    });
});
app.get("/create", function (req, res) {
    res.render("create", { error: "" });
});
app.get("/gmap", function (req, res) {
    res.render("gmap", { lon: req.query.lon, lat: req.query.lat, name: req.query.title });
});
app.get("/new", function (req, res) {
    res.render("new");
});
app.get("/read", function (req, res) {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err, null);
        } catch (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("MongoClient connect() failed!");
            return (-1);
        }
        const db = client.db(dbName);

        //console.log(JSON.parse(req.query.criteria));
        search_restaurant(db, req.query, (restaurant, criteria) => {
            client.close();
            res.render("read", { restaurant: restaurant, criteria: JSON.stringify(criteria) });
        });

    });
});
app.get("/remove", function (req, res) {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err, null);
        } catch (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("MongoClient connect() failed!");
            return (-1);
        }
        const db = client.db(dbName);

        //console.log(JSON.parse(req.query.criteria));
        deleteRestaurant(db, req.query._id, () => {
            client.close();
            res.render("remove");
        });

    });
});
app.post("/signup", function (req, res) {
    if (req.method.toLowerCase() == "post") {
        // parse a file upload
        const form = new formidable.IncomingForm();
        form.parse(req, (err, fields) => {
            if (fields.name && fields.name.length > 0) {
                name = fields.name;
            }
            if (fields.password && fields.password.length > 0) {
                password = fields.password;
            }

            let client = new MongoClient(mongourl);
            client.connect((err) => {
                try {
                    assert.equal(err, null);
                } catch (err) {
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    res.end("MongoClient connect() failed!");
                    return (-1);
                }
                const db = client.db(dbName);
                let new_r = {};
                new_r['userid'] = name;
                new_r['password'] = password;
                checkUser(db, new_r, (user) => {
                    if (user.length <= 0) {
                        createAccount(db, new_r, () => {
                            client.close();
                            res.redirect('/login?create=success');

                        })
                    } else {
                        client.close();
                        res.render('create', { error: "User ID already exists" });
                    }

                });

            });
        })

    }
});
app.get("/display", function (req, res) {
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err, null);
        } catch (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("MongoClient connect() failed!");
            return (-1);
        }
        const db = client.db(dbName);

        search_restaurant(db, req.query, (restaurant, temp) => {
            res.render("display", { restaurant: restaurant });

        });
    });
});
app.post("/processlogin", function (req, res) {
    const form = new formidable.IncomingForm();
    form.parse(req, (err, fields) => {
        if (fields.name && fields.name.length > 0) {
            name = fields.name;
        }
        if (fields.password && fields.password.length > 0) {
            password = fields.password;
        }
        let client = new MongoClient(mongourl);
        client.connect((err) => {
            try {
                assert.equal(err, null);
            } catch (err) {
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end("MongoClient connect() failed!");
                return (-1);
            }
            const db = client.db(dbName);
            let new_r = {};
            new_r['userid'] = name;
            new_r['password'] = password;
            checkLogin(db, new_r, (user) => {
                if (user.length > 0)
                    res.redirect('read');
                else
                    res.redirect('login?login=fail');
            });
        });

    });
});
app.post("/createRestaurant", function (req, res) {
    if (req.method.toLowerCase() == "post") {
        // parse a file upload
        const form = new formidable.IncomingForm();
        let new_r = {};
        let address = {};
        let coord = [];
        form.parse(req, (err, fields, files) => {
            for (i in fields) {
                if (i == "street" || i == "building" || i == "zipcode"
                ) {
                    address[i] = fields[i];
                }
                else if (i == "lon" || i == "lat") {
                    coord.push(fields[i]);
                } else if (i == 'sampleFile') { }
                else {
                    new_r[i] = fields[i];
                }
            }
            new_r['address'] = address;
            new_r['address']['coord'] = coord;
            new_r['grades'] = [];
            if (files.sampleFile.type) {
                mimetype = files.sampleFile.type;
            }
            new_r['mimetype'] = mimetype;
            fs.readFile(files.sampleFile.path, (err, data) => {
                new_r['image'] = new Buffer.from(data).toString('base64');
                let client = new MongoClient(mongourl);
                client.connect((err) => {
                    try {
                        assert.equal(err, null);
                    } catch (err) {
                        res.writeHead(500, { "Content-Type": "text/plain" });
                        res.end("MongoClient connect() failed!");
                        return (-1);
                    }
                    const db = client.db(dbName);

                    insertRestaurant(db, new_r, (restaurant) => {
                        client.close()
                        res.redirect('display?_id=' + restaurant['_id'])
                    });

                });
            });
        });
    }
});
app.post("/rate", function (req, res) {
    if (req.method.toLowerCase() == "post") {
        // parse a file upload
        const form = new formidable.IncomingForm();
        form.parse(req, (err, fields) => {
            score = fields.score;
            let client = new MongoClient(mongourl);
            client.connect((err) => {
                try {
                    assert.equal(err, null);
                } catch (err) {
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    res.end("MongoClient connect() failed!");
                    return (-1);
                }
                const db = client.db(dbName);

                insertSocre(db, req.query, score, (restaurant) => {
                    client.close()
                    res.redirect('display?_id=' + req.query._id)
                });

            });

        });
    }
});
app.post("/change", function (req, res) {
    if (req.method.toLowerCase() == "post") {
        // parse a file upload
        const form = new formidable.IncomingForm();
        let new_r = {};
        let address = {};
        let coord = [];
        form.parse(req, (err, fields, files) => {
            for (i in fields) {
                if (i == "street" || i == "building" || i == "zipcode"
                ) {
                    address[i] = fields[i];
                }
                else if (i == "lon" || i == "lat") {
                    coord.push(fields[i]);
                } else if (i == 'sampleFile') { }
                else {
                    new_r[i] = fields[i];
                }
            }
            new_r['address'] = address;
            new_r['address']['coord'] = coord;
            if (files.sampleFile.size != 0) {
                console.log("size:" + files.sampleFile.size);
                mimetype = files.sampleFile.type;
                new_r['mimetype'] = mimetype;
                fs.readFile(files.sampleFile.path, (err, data) => {
                    new_r['image'] = new Buffer.from(data).toString('base64');
                });
            }
            let client = new MongoClient(mongourl);
            client.connect((err) => {
                try {
                    assert.equal(err, null);
                } catch (err) {
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    res.end("MongoClient connect() failed!");
                    return (-1);
                }
                const db = client.db(dbName);

                updateRestaurant(db, new_r, (restaurant) => {
                    client.close()
                    res.redirect('display?_id=' + fields['_id']);
                });

            });
        });

    }
});

const createAccount = (db, r, callback) => {
    db.collection('user').insertOne(r, (err, result) => {
        assert.equal(err, null);
        callback();
    });
}

const checkLogin = (db, criteria, callback) => {
    const cursor = db.collection("user").find(criteria);
    cursor.toArray((err, user) => {
        assert.equal(err, null);
        callback(user);
    });

}

const checkUser = (db, criteria, callback) => {
    const cursor = db.collection("user").find({ userid: criteria['userid'] });
    cursor.toArray((err, user) => {
        assert.equal(err, null);
        callback(user);
    });
}

const search_restaurant = (db, criteria, callback) => {

    var jsonReturn = { ...criteria };

    for (temp in criteria) {
        if (temp == '_id') {
            criteria[temp] = ObjectID(criteria[temp]);
        } else
            criteria[temp] = { $regex: criteria[temp], $options: 'i' };

    }
    const cursor = db.collection('project_restaurant').find(criteria);


    cursor.toArray((err, user) => {
        assert.equal(err, null);
        callback(user, jsonReturn);
    });


}

const insertRestaurant = (db, criteria, callback) => {

    db.collection('project_restaurant').insertOne(criteria, (err, result) => {
        assert.equal(err, null);
        callback(result.ops[0]);
    });


}

const insertSocre = (db, criteria, fields, callback) => {

    let temp = {};
    let toupdate = {};
    temp['_id'] = ObjectID(criteria._id);
    toupdate['score'] = fields;
    toupdate['user'] = "demo";
    db.collection('project_restaurant').updateOne(temp,
        { $push: { grades: toupdate } }, (err, result) => {
            assert.equal(err, null);
            callback()
        });


}

const updateRestaurant = (db, criteria, callback) => {

    let temp = {};
    temp['_id'] = ObjectID(criteria._id);
    delete criteria._id;
    db.collection('project_restaurant').find(temp, { $set: criteria },
        (err, result) => {
            assert.equal(err, null);
            callback()
        });


}

const deleteRestaurant = (db, criteria, callback) => {

    let temp = {};
    temp['_id'] = ObjectID(criteria);
    db.collection('project_restaurant').deleteOne(temp,
        (err, result) => {
            assert.equal(err, null);
            callback()
        });


}
app.listen(process.env.PORT || 8099);

