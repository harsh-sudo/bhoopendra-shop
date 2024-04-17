const mongoose = require('mongoose')
const plm = require('passport-local-mongoose')

// TODO: connect to mongoose


mongoose.connect('mongodb+srv://bhoopendra:bhoopendra999@bhoopendra.e2jrvmk.mongodb.net/shop?retryWrites=true&w=majority&appName=bhoopendra')

const userSchema = mongoose.Schema({
  username: String,
  password: String,
  email: String,
  accountType: {
    type: String,
    enums: [ 'seller', 'buyer' ],
    default: 'buyer'
  },
  wishlist: [ {
    type: mongoose.Schema.Types.ObjectId,
    ref: "product"
  } ],

})

userSchema.plugin(plm)

module.exports = mongoose.model('user', userSchema)

