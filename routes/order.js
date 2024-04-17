const mongoose = require('mongoose')

const orderItemsSchema = mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'product'
    },
    quantity: { type: Number }
});


const orderSchema = mongoose.Schema({
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    orderItems: [orderItemsSchema],
    price: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed'],
        default: 'pending'
    },
})
module.exports = mongoose.model('order', orderSchema)
