const express = require('express');
const cors = require('cors');
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

// connect to the database
client.connect(err => {
    if (err) {
        console.log('Error connecting to database', err);
    } else {
        console.log('Connected to database');
    }
});

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


app.get('/booking', async (req, res) => {

    const query = {
        email: req.query.email,
        date: req.query.date

    }
    const result = await bookings.find(query).toArray();
    res.send(result);
})


app.listen(port, () => {
    console.log('server is running on port' + port);
})