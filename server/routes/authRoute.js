const router = require("express").Router();
const User = require("../models").user;

const registerVaildation = require("../vaildation").registerVaildation;
const loginVaildation = require("../vaildation").loginVaildation;

const passport = require("passport");
require("../config/passport")(passport);
require("../config/googlepassport")(passport);

const jwt = require("jsonwebtoken");

//google
const CLIENT_URL = "https://mernfrontend-3koa.onrender.com/";

router.use((req, res, next) => {
  console.log("正在接收auth的請求");
  next();
});

//login
router.post("/login", async (req, res) => {
  let { error } = loginVaildation(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const user = await User.findOne({ email: req.body.email })
    .populate("cartlist")
    .populate("enrolllist")
    .exec();
  if (!user) return res.status(401).send("此信箱尚未註冊過");

  user.comparePassword(req.body.password, (err, isMath) => {
    //err==null or e
    if (err) return res.status(500).send(err);
    //comparePassword 會回傳true or false
    //輸入正確的密碼，加入jwt token 回傳給瀏覽器
    if (isMath) {
      //登入正確時 給予jwt token 存在localstorge
      const tokenObj = { _id: user._id, email: user.email };
      const token = jwt.sign(tokenObj, process.env.PASSPORT_SECRET);
      return res.send({
        message: "登入成功",
        token: "JWT " + token,
        user,
      });
    } else {
      return res.status(401).send("密碼輸入錯誤");
    }
  });
});

//register
router.post("/register", async (req, res) => {
  //傳遞內容需要經過驗證，是否符合schema資格
  let { error } = registerVaildation(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  //確認信箱是否有使用過
  const emailExist = await User.findOne({ email: req.body.email }).exec();
  if (emailExist) return res.status(400).send("此信箱已經註冊過了");

  //新增使用者
  try {
    let { username, email, password } = req.body;
    let newUser = new User({ username, email, password });

    //在save()之前會進入pre() 裡面設定的middleware 做判斷
    let saveUser = await newUser.save();

    return res.send({
      msg: "使用者儲存成功",
      saveUser,
    });
  } catch (e) {
    return res.status(500).send("無法儲存");
  }
});

//google
router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);
router.get(
  "/auth/google/redirect",
  passport.authenticate("google", {
    successMessage: "登入成功",
    successRedirect: CLIENT_URL,
    failureRedirect: CLIENT_URL + "login/failed",
  })
);

router.get("/login/success", (req, res) => {
  console.log("login success ");
  console.log(req.isAuthenticated());
  if (req.isAuthenticated()) {
    let user = req.user;
    const tokenObj = { _id: user._id, email: user.email };
    const token = jwt.sign(tokenObj, process.env.PASSPORT_SECRET);
    return res.send({ loginSuccess: true, token: token, user });
  } else {
    console.log("not auth");
    return res.send({
      loginSuccess: false,
    });
  }
});
router.get("/login/failed", (req, res) => {
  res.status(401).json({ error: true, message: "Log in failure" });
});

router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.log(err);
    }
    res.redirect(CLIENT_URL);
  });
});

module.exports = router;
