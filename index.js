const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express();

//middleware
app.use(express.json());
app.use(cors());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.odx3u2z.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
const appointmentOptions = client.db("drivingPortal").collection("appointmentOptions");
const bookings = client.db("drivingPortal").collection("bookings");
const users = client.db("drivingPortal").collection("users");
const messages = client.db("drivingPortal").collection("messages");


// connect to the database
client.connect(err => {
    if (err) {
        console.log('Error connecting to database', err);
    } else {
        console.log('Connected to database');
    }
});


const verifyJWT = (req, res, next) => {
    const headers = req.headers.authorization;
    if (!headers) {
        res.send({
            message: 'access not allow'
        })
    }
    const token = headers.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
        if (err) {
            return res.send({
                message: "access forbidden"
            })
        }
        req.decoded = decoded
        next()
    })
}

app.post('/messages', async (req, res) => {
    const details = req.body;
    details.status = "Not Replay"
    const result = await messages.insertOne(details);
    if (result.insertedId) {
        res.send({
            success: true,
            message: "Message Sent Successfully We Contact You ASAP"
        })
    } else {
        res.send({
            success: false,
            message: "please try again"
        })
    }
})

app.get('/messages', verifyJWT, async (req, res) => {
    const email = req.decoded.email;
    const user = await users.findOne({ email: email });
    if (!user) {
        return res.send([]);
    }
    if (user?.role === "staff" || user?.role === "admin") {
        const result = await messages.find({}).sort({ _id: -1 }).toArray();
        return res.send(result)
    }

    return res.send([])
})


app.get('/appointment-options', async (req, res) => {
    const date = req.query.date;
    const alreadyBookings = await bookings.find({ date: date }).toArray();
    const options = await appointmentOptions.find({}).toArray();
    options.forEach(option => {
        //match booking making array
        const optionBooked = alreadyBookings.filter(booked => option.name === booked.serviceName);

        //get the only booking time or slot 
        const bookedSlots = optionBooked.map(book => book.time)
        option.slots = option.slots.filter(slot => !bookedSlots.includes(slot))
    })


    res.send(options);
})

app.post('/users', async (req, res) => {
    const user = req.body;
    const alreadyExist = await users.findOne({ email: user.email });
    if (alreadyExist) {
        return res.send({
            success: false,
            message: "Already email Used"
        })
    }
    const result = await users.insertOne(user);
    res.send(result);
})

app.get('/role/:email', async (req, res) => {
    const email = req.params.email;
    const result = await users.findOne({ email: email });
    if (result) {
        res.send({ role: result.role })
    } else {
        res.send({ role: 'member' })
    }
})

app.get('/users', verifyJWT, async (req, res) => {
    const reqEmail = req.decoded.email;

    console.log(reqEmail);
    const isAdmin = await users.findOne({ email: reqEmail });
    if (isAdmin?.role !== "admin") {
        return res.send({
            success: false,
            message: "Your Not Permission view Users"
        })
    }

    let query = req.query.role || {}
    if (req.query.role) {
        query = { role: req.query.role }
    }


    const result = await users.find(query).toArray();
    res.send(result)
})

app.post('/admin/role', verifyJWT, async (req, res) => {
    const decodedEmail = req.decoded;
    const id = req.body.id;
    const role = req.body.role || "Member"

    const isAdmin = await users.findOne({ email: decodedEmail.email });
    console.log(isAdmin);
    if (isAdmin?.role !== "admin") {
        return res.send({
            success: false,
            message: "Your Not Permission Change User Role"
        })
    }

    const query = { _id: ObjectId(id) }

    const isExist = await users.findOne(query);
    if (!isExist) {
        return res.send({
            success: false,
            message: "User Not Found"
        });
    }
    const option = {
        upsert: true
    }
    const updateDoc = {
        $set: {
            role: role
        }
    }
    const result = await users.updateOne(query, updateDoc, option);
    console.log(result);
    if (result.modifiedCount) {
        res.send({
            success: true,
            message: "user updated Now Admin"
        })
    } else {
        res.send({
            success: false,
            message: "something went.."
        })
    }
})


app.post('/booking', async (req, res) => {
    const bookingDetails = req.body;
    const result = await bookings.insertOne(bookingDetails);
    if (result.acknowledged) {
        res.send({
            success: true,
            message: 'Booking Success'
        })
    } else {
        res.send({
            success: false,
            message: 'please try again'
        })
    }
})

app.get('/jwt', (req, res) => {
    const email = req.query.email;
    const token = jwt.sign({ email }, process.env.JWT_SECRET);
    res.send({ token });
})


app.get('/booking', verifyJWT, async (req, res) => {
    const decoded = req.decoded;

    const query = {
        email: req.query.email,
        date: req.query.date

    }
    if (decoded.email !== query.email) {
        return res.send({
            message: "access not allow"
        })
    }
    const result = await bookings.find(query).toArray();
    res.send(result);
})

app.get('/all-appointments', verifyJWT, async (req, res) => {
    const email = req.decoded.email;
    const user = await users.findOne({ email: email });
    if (user.role === "admin" || user.role === "staff") {
        const result = await bookings.find({}).sort({ _id: -1 }).toArray();
        res.send(result)
    } else {
        res.send([])
    }
})

app.listen(port, () => {
    console.log('server is running on port' + port);
})