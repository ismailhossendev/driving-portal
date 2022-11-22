const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const bodyParser = require('body-parser')
const SSLCommerzPayment = require("sslcommerz-lts");

const port = process.env.PORT || 5000;
const app = express();

//middleware
app.use(express.json());
app.use(cors());

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.odx3u2z.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
const appointmentOptions = client.db("drivingPortal").collection("appointmentOptions");
const bookings = client.db("drivingPortal").collection("bookings");
const users = client.db("drivingPortal").collection("users");
const messages = client.db("drivingPortal").collection("messages");
const payment = client.db("drivingPortal").collection("payment");


// connect to the database
// client.connect(err => {
//     if (err) {
//         console.log('Error connecting to database', err);
//     } else {
//         console.log('Connected to database');
//     }
// });


const verifyJWT = (req, res, next) => {
    const headers = req.headers.authorization;
    if (!headers) {
        res.status(401).send({
            message: 'access not allow'
        })
    }
    const token = headers.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({
                message: "access forbidden"
            })
        }
        req.decoded = decoded
        next()
    })
}

const verifyAdmin = async (req, res, next) => {
    const email = req.decoded.email;
    const user = await users.findOne({ email: email });
    if (user?.role !== "admin") {
        return res.status(403).send({
            success: false,
            messages: "access not forbidden"
        })
    }
    next();
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


app.get('/', (req, res) => {
    res.send("Serve is running")
});

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

app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {

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
    if (!bookingDetails.price) {
        bookingDetails.price = 1000;
    }
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
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
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


//manage all services

//see all services and how many appointment on this services
app.get('/services', verifyJWT, verifyAdmin, async (req, res) => {
    const services = await appointmentOptions.find({}).project({ name: 1 }).toArray();
    const howMany = await bookings.find({}).project({ serviceName: 1 }).toArray();
    services.forEach(service => {
        const finding = howMany.filter(book => book.serviceName === service.name)
        service.total = finding.length
    })
    res.send(services);
})

app.post('/services', async (req, res) => {
    const service = req.body;
    const result = await appointmentOptions.insertOne(service);
    if (result.insertedId) {
        res.send({
            success: true,
            messages: 'Service Added Successfully'
        })
    } else {
        res.send({
            success: false,
            messages: 'Service Added Failed'
        })
    }
})

app.delete('/service-delete/', verifyJWT, verifyAdmin, async (req, res) => {
    const id = req.query.id;
    const result = await appointmentOptions.deleteOne({ _id: ObjectId(id) });
    console.log(result);
    if (result.deletedCount) {
        res.send({
            success: true,
            messages: "Delete Success"
        })
    } else {
        res.send({
            success: false,
            messages: "Delete Failed"
        })
    }
});




//payment integration

const store_id = process.env.STORE_ID
const store_passwd = process.env.STORE_PASSWORD
const is_live = false;

app.post('/payment-req/', async (req, res) => {
    const { price, _id } = req.body;
    const data = {
        total_amount: Number(price),
        currency: 'BDT',
        tran_id: _id, // use unique tran_id for each api call
        success_url: 'http://localhost:5000/ssl-payment-success',
        fail_url: 'http://localhost:5000/ssl-payment-fail',
        cancel_url: 'http://localhost:5000/ssl-payment-cancel',
        ipn_url: 'http://localhost:5000/ssl-payment-ipn',
        shipping_method: 'Courier',
        product_name: 'Computer.',
        product_category: 'Electronic',
        product_profile: 'general',
        cus_name: 'Customer Name',
        cus_email: 'customer@example.com',
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
    };
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
    sslcz.init(data).then(apiResponse => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL
        res.send({ GatewayPageURL })
    });
})

app.post("/ssl-payment-fail", async (req, res) => {

    const query = { _id: ObjectId(req.body.tran_id) }
    const option = {
        upsert: true
    }
    const updateDoc = {
        $set: {
            status: 'FAILED',
            messages: 'Your Payment is fail Try again',
        }
    }

    const result2 = await bookings.updateOne(query, updateDoc, option);
    res.redirect(`http://localhost:3000/confirmation/${req.body.tran_id}`)


})

app.post("/ssl-payment-cancel", async (req, res) => {

    const query = { _id: ObjectId(req.body.tran_id) }
    const option = {
        upsert: true
    }
    const updateDoc = {
        $set: {
            status: 'CANCEL',
            messages: 'You Cancel Your Payment Please Try Again',
            paymentMethod: req.body.card_type
        }
    }

    const result2 = await bookings.updateOne(query, updateDoc, option);
    res.redirect(`http://localhost:3000/confirmation/${req.body.tran_id}`)


})


app.post("/ssl-payment-success", async (req, res) => {

    const result = await payment.insertOne(req.body);
    const id = result.insertedId.toString()

    const query = { _id: ObjectId(req.body.tran_id) }
    const option = {
        upsert: true
    }
    const updateDoc = {
        $set: {
            status: 'PAID',
            messages: 'Thanks For Payment Your Appointment Is Confirm',
            paidId: id,
            paymentMethod: req.body.card_type
        }
    }

    const result2 = await bookings.updateOne(query, updateDoc, option);
    res.redirect(`http://localhost:3000/confirmation/${req.body.tran_id}`)
})

app.get('/confirmation/:id', async (req, res) => {
    const id = req.params.id;
    const query = { _id: ObjectId(id) }
    const result = await bookings.findOne(query).project({ status: 1 });
    console.log(result);
    res.send(result)
})



app.listen(port, () => {
    console.log('server is running on port' + port);
})

module.exports = app;