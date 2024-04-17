var express = require('express');
var router = express.Router();
const userModel = require('./users')
const productModel = require('./product')
const cartModel = require('./cart')
const cartProductModel = require('./cartProduct')
const orderModel = require('./order');
const Razorpay = require('razorpay');

var instance = new Razorpay({
  key_id: 'rzp_test_UpxsCsItiWa1C4',
  key_secret: 'hbhbWkZPSNTVCTzeQ3XJJWzD',
});

var users = require('./users')
var passport = require('passport')
var localStrategy = require('passport-local')
passport.use(new localStrategy(users.authenticate()))
const upload = require('./multer')

/* GET home page. */
router.get('/', isloggedIn, async function (req, res, next) {
  const allProducts = await productModel.find()
  res.render('index', { title: 'Express', allProducts });
});


router.get('/register', function (req, res) {
  res.render('register', { title: 'Register' });
})


router.post('/register', function (req, res) {

  var userData = new userModel({
    username: req.body.username,
    accountType: req.body.isSeller === 'on' ? "seller" : 'buyer'
  })
  userModel
    .register(userData, req.body.password)
    .then(function (registeredUser) {
      passport.authenticate('local')(req, res, function () {
        console.log('registered user', registeredUser)
        if (registeredUser.accountType === 'seller') {
          res.redirect("/createProduct")
          return
        }
        res.redirect('/');
      })
    })
});

function isloggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  else res.redirect('/login');
}

function isSeller(req, res, next) {
  if (req.user.accountType === 'seller') return next()
  else res.redirect('/')
}


router.get('/login', function (req, res) {
  res.render('login', { title: 'Login' });
})


router.post(
  '/login',
  passport.authenticate('local', {
    failureRedirect: '/login',
  }),
  (req, res, next) => {
    if (req.user.accountType == 'seller') {
      res.redirect('/createProduct')
    }
    else {
      res.redirect('/')
    }
  }
);


router.get('/logout', (req, res, next) => {
  if (req.isAuthenticated())
    req.logout((err) => {
      if (err) res.send(err);
      else res.redirect('/');
    });
  else {
    res.redirect('/');
  }
});

router.get('/createProduct', isloggedIn, isSeller, function (req, res) {
  res.render('createProduct', { title: 'Create Product' });
})


router.post('/createProduct', isloggedIn, isSeller, upload.array('image'), async (req, res, next) => {

  const newProduct = await productModel.create({
    name: req.body.name,
    price: Number(req.body.price),
    description: req.body.description,
    user: req.user._id,
    images: req.files.map(file => {
      return "/upload/" + file.filename
    })
  })

  res.redirect('/')

})

router.get('/cart', isloggedIn, async (req, res, next) => {
  const userCart = await cartModel.findOne({
    user: req.user._id
  }).populate('products').populate({
    path: "products",
    populate: 'product'
  })

  userCart.save();

  res.render('cart', { userCart })
})

router.get('/profile', (req, res, next) => {
  res.render('profile')
})

router.get('/addToCart/:productId', isloggedIn, async (req, res, next) => {
  const productId = req.params.productId
  let product = await productModel.findById(productId)
  if(!product) return res.status(404).send("Product not found");

  let userCart = await cartModel.findOne({
    user: req.user._id
  })

  if (!userCart) {
    userCart = await cartModel.create({
      user: req.user._id,
    })
  }


  let newCartProduct = await cartProductModel.findOne({
    product: productId,
    _id: { $in: userCart.products }
  })

  if (newCartProduct) {
    newCartProduct.quantity = newCartProduct.quantity + 1
    userCart.price = userCart.price + product.price;
    await newCartProduct.save()
  }
  else {
    newCartProduct = await cartProductModel.create({
      product: productId,
      quantity: 1,
    })
    userCart.products.push(newCartProduct._id)
    userCart.price = userCart.price + product.price
  }
  
  
  await userCart.save()
  res.redirect('back')

})

router.post('/updateQuantity', isloggedIn, async (req, res, next) => {
  let userCart = await cartModel.findOne({
    user: req.user._id
  })
  if(!userCart) return res.status(404).send("Cart not found");
  let product = await cartProductModel.findById(req.body.cartProductId).populate('product');
  if(!product) return res.status(404).send("Product not found");
  userCart.price = userCart.price - (product.product.price * product.quantity) + (product.product.price * req.body.quantity);
  await userCart.save();

  await cartProductModel.findOneAndUpdate({ _id: req.body.cartProductId }, {
    quantity: req.body.quantity
  })
  res.json({ message: "quantity updated", price: userCart.price})
})

router.get('/remove/:cartProductId', isloggedIn, async (req, res, next) => {
  const userCart = await cartModel.findOne({
    user: req.user._id
  })
  if(!userCart) return res.status(404).send("Cart not found");
  let product = await cartProductModel.findById(req.params.cartProductId).populate('product');
  if(!product) return res.status(404).send("Product not found");
  userCart.price = userCart.price - (product.product.price * product.quantity);
  userCart.products = userCart.products.filter(p => p.toString() !== req.params.cartProductId);
  await userCart.save();
  await cartProductModel.findOneAndDelete({ _id: req.params.cartProductId })
  res.redirect('back')
})

router.get('/checkout', isloggedIn, async (req, res, next) => {
  const userCart = await cartModel.findOne({
    user: req.user._id
  }).populate('products').populate({
    path: "products",
    populate: 'product'
  })
  if(!userCart) return res.status(404).send("Cart not found");
  let items = await orderModel.findOne({customer: req.user._id, status: 'pending'}).populate('orderItems.product');
  if(items){
    var options = {
      amount: items.price * 100,  // amount in the smallest currency unit
      currency: "INR",
      receipt: "order_rcptid_11"
    };
    let order = await instance.orders.create(options);
    console.log(order)
    return res.render('checkout', {items, order});
  } 
  let newItems = await orderModel.create({
    customer: req.user._id,
    orderItems: userCart.products.map(product => {
      return {
        product: product.product._id,
        quantity: product.quantity
      }
    }),
    price: userCart.price
  })
  await newItems.populate('orderItems.product').execPopulate();

  var options = {
    amount: newItems.price * 100,  // amount in the smallest currency unit
    currency: "INR",
    receipt: "order_rcptid_11"
  };
  let order = await instance.orders.create(options);
  res.render('checkout', {items: newItems, order});
})



router.post('/verify-payment', async (req, res, next) => {
  const {razorpay_order_id, razorpay_payment_id, razorpay_signature} = req.body.response;
  let signature = razorpay_signature;
  let secret = 'hbhbWkZPSNTVCTzeQ3XJJWzD';
  var { validatePaymentVerification } = require('../node_modules/razorpay/dist/utils/razorpay-utils');
  let result = validatePaymentVerification({"order_id": razorpay_order_id, "payment_id": razorpay_payment_id }, signature, secret);
  if(result){
    let order = await orderModel.findOneAndUpdate({customer: req.user._id, status: 'pending'}, {
      status: 'processing'
    })
    return res.json({status: "success"})
  }
  return res.json({status: "failed"})
})

router.get("/order/success/:orderId", isloggedIn, async (req, res, next) => {
  let order = await orderModel.findOne({customer: req.user._id, status: 'processing'}).populate('orderItems.product');
  if(!order) return res.status(404).send("Order not found");
  const orderId = parseInt(order._id.toString().slice(-4), 16);
  let userCart = await cartModel.findOne({
    user: req.user._id
  })
  if(userCart){
    userCart.products = [];
    userCart.price = 0;
    await userCart.save();
  }
  return res.render('orderSuccess', {order,orderId});
});

router.get("/orders", isloggedIn, async (req, res, next) => {
  let orders = await orderModel.find({customer: req.user._id}).populate('orderItems.product');
  res.json(orders);
})



module.exports = router;


// key_id = "rzp_test_UpxsCsItiWa1C4"
// key_secret = "hbhbWkZPSNTVCTzeQ3XJJWzD"