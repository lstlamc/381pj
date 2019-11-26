const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const url = require('url');
const fs = require('fs');
const formidable = require('formidable');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const ObjectID = require('mongodb').ObjectID;
const mongourl = "mongodb://me:381lab@381-lab-shard-00-00-au1bm.azure.mongodb.net:27017,381-lab-shard-00-01-au1bm.azure.mongodb.net:27017,381-lab-shard-00-02-au1bm.azure.mongodb.net:27017/test?ssl=true&replicaSet=381-lab-shard-0&authSource=admin&retryWrites=true&w=majority";
const dbName = "test";

app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.post('/api/restaurant', function (req, res) {
    let newDoc = {};
    let address = {};
    var nameFound = false;
    for (i in req.body) {
        if (i == "address") {
            for (a in req.body[i]) {
                if (a == "building" || a == "street" || a == "zipcode" || a == "coord") {
                    address[a] = req.body[i][a];
                }

            }
        }
        else if (i == "borough" || i == "cuisine" || i == "restaurant_id") {
            newDoc[i] = req.body[i];
        }
        else if (i == "name" && req.body[i] != null) {
            nameFound = true;
            newDoc[i] = req.body[i];
        }
    }
    newDoc['address'] = address;

    var resp = {};
    if (nameFound) {

        let client = new MongoClient(mongourl);
        client.connect((err) => {
            try {
                assert.equal(err, null);
            } catch (err) {
                resp['status'] = "Failed";
                res.status(500).type('json').json(resp).end();
                return (-1);
            }
            resp['status'] = "ok";
            const db = client.db(dbName);

            db.collection('project_restaurant').insertOne(newDoc, (err, result) => {
                try {
                    assert.equal(err, null);
                } catch (err) {
                    resp['status'] = "Failed";
                    client.close();
                    res.status(500).type('json').json(resp).end();
                    return (-1);
                }
                client.close();
                resp['_id'] = result.ops[0]['_id'];
                res.status(200).type('json').json(resp).end();

            });


        });
    } else {
        resp['status'] = "Failed";
        res.status(500).type('json').json(resp).end();
    }
});
app.get("/api/restaurant/:type/:data", function (req, res) {
    let search = {};
    search[req.params.type] = req.params.data;

    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err, null);
        } catch (err) {
            res.status(500).json({ status: "connection failed" }).end();
            return (-1);
        }
        const db = client.db(dbName);

        let result = [];
        search_restaurant(db, search, (restaurant, temp) => {
            if (restaurant.length <= 0) {
                res.status(200).json({}).end();
                return;
            }
            restaurant.forEach((temp_r) => {
                let rest = {};
                rest['restaurant'] = JSON.stringify(temp_r);
                result.push(rest);


            });
            res.status(200).json(result).end();

        });
    });
});
app.get("/api/restaurant", function (req, res) {
    let search = {};
    let client = new MongoClient(mongourl);
    client.connect((err) => {
        try {
            assert.equal(err, null);
        } catch (err) {
            res.status(500).json({ status: "connection failed" }).end();
            return (-1);
        }
        const db = client.db(dbName);

        let result = [];
        search_restaurant(db, search, (restaurant, temp) => {
            if (restaurant.length <= 0) {
                res.status(200).json({}).end();
                return;
            }
            restaurant.forEach((temp_r) => {
                let rest = {};
                rest['restaurant'] = JSON.stringify(temp_r);
                result.push(rest);


            });
            res.status(200).json(result).end();

        });
    });
});
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

