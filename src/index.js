const express = require('express')
const mysql = require('mysql')
const app = express()
const bodyParser = require('body-parser')
const path = require('path')
const ejsMate = require('ejs-mate')
const methodOverride = require('method-override')
const ExpressError = require('./utils/ExpressError')
const bcrypt = require('bcrypt')
const session = require('express-session')
const flash = require('connect-flash')

app.use(bodyParser.urlencoded({ extended: true }))
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))
app.engine('ejs', ejsMate)
app.use(methodOverride('_method'))

const sessionConfig = {
  secret: 'thisismysecret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 10000 * 60 * 60 * 24 * 7,
    maxAge: 10000 * 60 * 60 * 24 * 7
  }
}

app.use(session(sessionConfig))
app.use(flash())

app.use((req, res, next) => {
  res.locals.username = req.session.username;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next()
})


const requireLogin = (req, res, next) => {
  if (!req.session.username) {
    return res.redirect('/login')
  } else {
    next()
  }
}


// console.log(path.join(__dirname, '/../public'))
const pathForPublic = path.join(__dirname, '/../public');
app.use(express.static(pathForPublic))

//create connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'agriculture',
  multipleStatements: true
});

//connecting to DB
db.connect((err) => {
  if (err) throw err;
  console.log('Database connected');
});

//landing page route
app.get('/', (req, res, next) => {
  try {
    let fertCount = 0;
    const query1 = `SELECT COUNT(fid) FROM fertilizer`
    db.query(query1, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      fertCount = result[0]['COUNT(fid)']
    })

    let equipCount = 0;
    const query2 = `SELECT COUNT(eid) FROM equipment`
    db.query(query2, (err1, result1) => {
      if (err1) throw new ExpressError(err1.message, err1.statusCode);
      equipCount = result1[0]['COUNT(eid)']
    })

    setTimeout(() => { res.render('home/homepage', { fertCount, equipCount }) }, 100)
  } catch (e) {
    next(e)
  }
  // res.send([fertCount, equipCount])
})

//login page route
app.get('/login', (req, res) => {
  res.render('Logins/login')
})

app.post('/login', async (req, res, next) => {
  try {
    const { username, pass } = req.body;
    const sql = `SELECT pass, fname FROM customer WHERE username = ?`
    db.query(sql, [username], async (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      if (result[0]) {
        const bcryptResult = await bcrypt.compare(pass, result[0].pass)
        const fname = result[0].fname;
        if (bcryptResult) {
          req.session.username = username;
          req.flash('success', `Welcome back! ${fname}`)
          // console.log(req.session.fname),
          res.redirect('/')
        } else {
          req.flash('error', 'Try again!')
          res.redirect('/login')
        }
      } else {
        req.flash('error', "You dont't have an account create a account first")
        res.redirect('/login')
      }
    })
  } catch (e) {
    next(e)
  }
})

//logout
app.post('/logout', (req, res, next) => {
  req.session.username = null;
  req.flash('success', 'logged out successfull')
  res.redirect('/')
})

// register page route
app.get('/register', (req, res) => {
  res.render('Logins/register')
})

app.post('/register', async (req, res, next) => {
  try {
    const { username, pass, fname, lname, sex, dob, phone, street, city, state, pincode } = req.body;
    const hashedPw = await bcrypt.hash(pass, 12);
    const sql = `INSERT into customer SET ?`
    const value = {
      username,
      pass: hashedPw,
      fname,
      lname,
      sex,
      dob,
      phone,
      street,
      city,
      state,
      pincode
    }

    db.query(sql, value, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode)
      req.flash('success', `Hi ${fname}, Welcome!`)
      req.session.username = username;
      res.redirect('/')
    })
  } catch (e) {
    next(e)
  }
})

app.get('/updateProfile', requireLogin, (req, res, next) => {
  try {
    const username = req.session.username;
    const sql = `SELECT * FROM customer WHERE username = ?`
    db.query(sql, [username], (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode)
      res.render('Logins/user', { user: result[0] })
      // res.send([result[0]])
    })
  } catch (e) {
    next(e)
  }
})

app.put('/updateProfile', requireLogin, (req, res, next) => {
  try {
    const username = req.session.username;
    const { fname, lname, sex, phone, street, city, pincode, state } = req.body
    const sql = `UPDATE customer SET ? WHERE username = ?`
    const value = {
      fname,
      lname,
      sex,
      phone,
      street,
      city,
      state,
      pincode
    }

    db.query(sql, [value, username], (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode)
      req.flash('success', 'Changes saved!')
      res.redirect('/updateProfile')
    })
  } catch (e) {
    next(e)
  }
})


// FERTILIZER MODULE:

// All fertilizers(get) => /fertilizers
app.get('/fertilizers', (req, res, next) => {
  try {
    const sql = 'SELECT * FROM fertilizer f, category c WHERE c.catno = f.catno'
    db.query(sql, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      // console.log(result)
      res.render('Fertilizers/allFertilizers', { fertilizers: result })
    })
  } catch (e) {
    next(e)
  }

})

// Add(post) => /fertilizer/new
app.get('/fertilizer/new', requireLogin, (req, res) => {
  res.render('Fertilizers/fertilizerNew')
})

app.post('/fertilizer/new', requireLogin, (req, res, next) => {
  try {
    const { fid, fname, fprice, fquantity, fmfg, fdesc, fexp, fimg, catno, crop_name, no_of_copies } = req.body

    const fvalue = {
      'fid': fid,
      'fname': fname,
      'fdesc': fdesc,
      'fprice': fprice,
      'fquantity': fquantity,
      'fmfg': fmfg,
      'fexp': fexp,
      'fimg': fimg,
      'catno': catno
    }

    const crvalue = {
      'crop_name': crop_name,
      'fid': fid
    }

    const fcvalue = {
      'fid': fid,
      'catno': catno,
      'no_of_copies': no_of_copies
    }

    let fSql = "INSERT INTO fertilizer SET ? "
    db.query(fSql, fvalue, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
    })

    let crSql = "INSERT INTO affects SET ? "
    db.query(crSql, crvalue, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
    })

    let fcSql = "INSERT INTO fertilizers_copies SET ? "
    db.query(fcSql, fcvalue, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
    })
    req.flash('success', 'New fertilizer added!')
    res.redirect(`/fertilizer/${fid}`)
  } catch (e) {
    next(e)
  }
})

// Edit(put) => /fertilizer/fid
app.get('/fertilizer/edit/:fid', requireLogin, (req, res, next) => {
  try {
    const { fid } = req.params
    let sql = `SELECT * FROM affects WHERE fid = ${fid};
    SELECT * FROM fertilizer f, category c WHERE f.catno = c.catno AND f.fid = ${fid};
    SELECT * FROM fertilizers_copies WHERE fid = ${fid};`

    db.query(sql, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      // console.log(result)
      const cropNames = getCropsNames(result[0])
      const no_of_copies = getNoOfCopies(result[2][0])
      const fertilizerDetails = getFertilizerDetails(result[1][0])
      res.render('Fertilizers/fertilizerEdit', { cropNames, no_of_copies, fertilizerDetails })
    })
  } catch (e) {
    next(e)
  }

})

const getCropsNames = (items) => {
  let arr1 = []
  for (let item of items) {
    arr1.push(item.crop_name)
  }
  return arr1;
}

const getNoOfCopies = (item) => {
  return item.no_of_copies
}

const getFertilizerDetails = (item) => {
  let obj = {};
  obj['fid'] = item.fid
  obj['fname'] = item.fname
  obj['fdesc'] = item.fdesc
  obj['fprice'] = item.fprice
  obj['fquantity'] = item.fquantity
  obj['fmfg'] = item.fmfg
  obj['fexp'] = item.fexp
  obj['catno'] = item.catno
  obj['catname'] = item.catname
  obj['fimg'] = item.fimg
  return obj;
}

app.put('/fertilizer/:fid', requireLogin, (req, res, next) => {
  try {
    const { fid, fname, fdesc, fprice, fquantity, fimg, catno, no_of_copies } = req.body

    const fvalue = {
      fname,
      fdesc,
      fimg,
      fquantity,
      fprice,
      catno
    }

    const fcvalue = {
      catno,
      no_of_copies
    }

    let sql = `UPDATE fertilizer SET ? WHERE fid = ${fid}`
    db.query(sql, fvalue, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
    })

    let sql1 = `UPDATE fertilizers_copies SET ? WHERE fid = ${fid}`
    db.query(sql1, fcvalue, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      req.flash('success', 'Update saved')
      res.redirect(`/fertilizer/${fid}`)
    })

  } catch (e) {
    next(e)
  }

})


// show(get) => /fertilizer/fid
app.get('/fertilizer/:fid', (req, res, next) => {
  try {
    const { fid } = req.params
    const query = `SELECT reviews, username, rating FROM frating WHERE fid = ${fid};`
    let reviews = []
    db.query(query, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      reviews = result
    })


    let sql = `select * from fertilizer f, category c where c.catno = f.catno and f.fid = ${fid};
    SELECT no_of_copies FROM fertilizers_copies WHERE fid = ${fid}; 
    SELECT * FROM affects WHERE fid = ${fid}; 
    SELECT AVG(rating) AS rating FROM frating WHERE fid = ${fid}`
    db.query(sql, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      if (reviews) {
        res.render('Fertilizers/fertilizerShow', { fertilizer: result[0][0], fertCount: result[1][0], crops: result[2], reviews, rating: result[3][0].rating })
      } else {
        res.render('Fertilizers/fertilizerShow', { fertilizer: result[0][0], fertCount: result[1][0], crops: result[2], rating: result[3][0].rating })
      }
    });
  } catch (e) {
    next(e)
  }
})




//ADD review
app.post('/fertilizer/:fid/review', requireLogin, (req, res, next) => {
  try {
    const { fid } = req.params
    const { rating, reviews } = req.body;
    const value = {
      username: req.session.username,
      fid,
      rating,
      reviews
    }
    let sql = `INSERT INTO frating SET ?`
    db.query(sql, value, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      req.flash('success', 'review added Successfully!')
      res.redirect(`/fertilizer/${fid}`);
    })
  } catch (e) {
    next(e)
  }
})

// DELETE review
app.delete('/fertilizer/:fid/reviews/:username', requireLogin, (req, res, next) => {
  try {
    const { fid } = req.params
    // console.log(username, fid)
    let sql = `DELETE from frating where username = ? and fid = ?;`
    db.query(sql, [req.session.username, fid], (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode)
      req.flash('success', 'review deleted Successfully!')
      res.redirect(`/fertilizer/${fid}`)
    })
    // res.send('delete')
  } catch (e) {
    next(e)
  }
})


// Delete(delete) => /fertilizer/fid
app.delete('/fertilizer/:fid', requireLogin, (req, res, next) => {
  try {
    const { fid } = req.params
    let sql = `delete from fertilizer where fid = ${fid};`;
    db.query(sql, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      req.flash('success', 'Fertilizer deleted!')
      res.redirect('/fertilizers')
    })
  } catch (e) {
    next(e)
  }
})

// -----------EQUIPMENT MODULE--------------
// Add(post) => /equipment/new
// Delete(delete) => /equipment/eid
// Edit(put) => /equipment/eid

// index(get) => /eqipments
app.get('/equipments', (req, res, next) => {
  try {
    const sql = 'SELECT * FROM equipment e, ecategory c WHERE c.ecatno = e.ecatno'
    db.query(sql, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      // console.log(result)
      res.render('Equipments/allEquipments', { equipements: result })
    })
  } catch (e) {
    next(e)
  }
})

// Add(post) => /equipment/new
app.get('/equipment/new', requireLogin, (req, res) => {
  res.render('Equipments/equipmentNew')
})

app.post('/equipment/new', (req, res, next) => {
  try {
    const { eid, ename, eprice, emfg, edesc, eimg, ecatno, eno_of_copies, sid, emodel, eguarentee } = req.body

    const evalue = {
      eid,
      ename,
      edesc,
      eimg,
      eprice,
      emfg,
      eguarentee,
      emodel,
      ecatno,
      sid
    }

    const ecvalue = {
      eid,
      ecatno,
      eno_of_copies
    }

    let eSql = "INSERT INTO equipment SET ? "
    db.query(eSql, evalue, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
    })


    let ecSql = "INSERT INTO equipment_copies SET ? "
    db.query(ecSql, ecvalue, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
    })
    req.flash('success', 'New Equipment added!')
    res.redirect(`/equipment/${eid}`)
  } catch (e) {
    next(e)
  }
})

// Edit(put) => /equipment/fid
app.get('/equipment/edit/:eid', requireLogin, (req, res, next) => {
  try {
    const { eid } = req.params
    let sql = `SELECT * FROM equipment WHERE eid = ${eid};
    SELECT eno_of_copies FROM equipment_copies WHERE eid = ${eid};`

    db.query(sql, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      const eno_of_copies = getEnoOfCopies(result[1][0])
      const equipmentDetails = getEquipmentDetails(result[0][0])
      // console.log(eno_of_copies)
      res.render('Equipments/equipmentEdit', { eno_of_copies, equipmentDetails })
    })
  } catch (e) {
    next(e)
  }

})

const getEnoOfCopies = (item) => {
  return item.eno_of_copies
}

const getEquipmentDetails = (item) => {
  let obj = {};
  obj['eid'] = item.eid
  obj['ename'] = item.ename
  obj['edesc'] = item.edesc
  obj['eprice'] = item.eprice
  obj['ecatno'] = item.ecatno
  obj['eimg'] = item.eimg
  obj['emodel'] = item.emodel
  obj['sid'] = item.sid
  obj['eguarentee'] = item.eguarentee


  return obj;
}

app.put('/equipment/:eid', requireLogin, (req, res, next) => {
  try {
    const { eid, ename, edesc, eprice, eimg, ecatno, eno_of_copies, sid, emodel, eguarentee, } = req.body

    const evalue = {
      ename,
      edesc,
      eimg,
      eprice,
      eguarentee,
      emodel,
      ecatno,
      sid
    }

    const ecvalue = {
      ecatno,
      eno_of_copies
    }

    let sql = `UPDATE equipment SET ? WHERE eid = ${eid}`
    db.query(sql, evalue, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
    });

    let sql1 = `UPDATE equipment_copies SET ? WHERE eid = ${eid}`
    db.query(sql1, ecvalue, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      req.flash('success', 'Update saved!')
      res.redirect(`/equipment/${eid}`)
    });

  } catch (e) {
    next(e)
  }

})

// show(get) => /equipment/eid
app.get('/equipment/:eid', requireLogin, (req, res, next) => {
  try {
    const { eid } = req.params;
    const query = `SELECT e.review, e.username, e.rating FROM erating e WHERE e.eid = ${eid};`
    let reviews = []
    db.query(query, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      reviews = result
    })


    let sql = `select * from equipment e, ecategory c where c.ecatno = e.ecatno and e.eid = ${eid};
    SELECT eno_of_copies FROM equipment_copies WHERE eid = ${eid}; 
    SELECT s.sname, s.scity, s.spincode FROM seller s, equipment e WHERE eid = ${eid} and s.sid = e.sid; 
    SELECT AVG(rating) AS rating FROM erating WHERE eid = ${eid}`
    db.query(sql, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      // console.log(reviews)
      if (reviews) {
        res.render('Equipments/equipmentShow', { equipment: result[0][0], equipCount: result[1][0], seller: result[2][0], reviews, rating: result[3][0].rating })
      } else {
        res.render('Equipments/equipmentShow', { equipment: result[0][0], equipCount: result[1][0], seller: result[2][0], rating: result[3][0].rating })
      }
    });
  } catch (e) {
    next(e)
  }
})

//Add review
app.post('/equipment/:eid/review', requireLogin, (req, res, next) => {
  try {
    const { eid } = req.params
    const { rating, review } = req.body;
    const value = {
      username: req.session.username,
      eid,
      rating,
      review
    }
    let sql = `INSERT INTO erating SET ?`
    db.query(sql, value, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      req.flash('success', 'review added Successfully!')
      res.redirect(`/equipment/${eid}`);
    })
  } catch (e) {
    next(e)
  }
})

// DELETE review
app.delete('/equipment/:eid/reviews/:username', requireLogin, (req, res, next) => {
  try {
    const { eid } = req.params
    // console.log(username, eid)
    let sql = `DELETE from erating where username = ? and eid = ?;`
    db.query(sql, [req.session.username, eid], (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode)
      req.flash('success', 'review deleted Successfully!')
      res.redirect(`/equipment/${eid}`)
    })
    // res.send('delete')
  } catch (e) {
    next(e)
  }
})


// Delete(delete) => /equipment/eid
app.delete('/equipment/:eid', requireLogin, (req, res, next) => {
  try {
    const { eid } = req.params
    let sql = `delete from equipment where eid = ${eid};`;
    db.query(sql, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      req.flash('success', 'Equipment deleted!')
      res.redirect('/equipments')
    })
  } catch (e) {
    next(e)
  }
})

// add to cart
app.post('/fertilizer/:fid/tocart', requireLogin, (req, res, next) => {
  try {
    const { fid } = req.params
    const sql = `INSERT INTO fertilizercart SET ?`
    const value = {
      username: req.session.username,
      fid
    }
    db.query(sql, value, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      req.flash('success', 'Product added to cart!')
      res.redirect(`/fertilizer/${fid}`)
    })
  } catch (e) {
    next(e)
  }
})

app.post('/equipment/:eid/tocart', requireLogin, (req, res, next) => {
  try {
    const { eid } = req.params
    const sql = `INSERT INTO equipmentcart SET ?`
    const value = {
      username: req.session.username,
      eid
    }
    db.query(sql, value, (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      req.flash('success', 'Product added to cart!')
      res.redirect(`/equipment/${eid}`)
    })
  } catch (e) {
    next(e)
  }
})


app.get('/cartItems', requireLogin, (req, res, next) => {
  try {
    const username = req.session.username;
    let equipItems = []
    let totalPrice = 0;
    const sql = `SELECT * FROM equipmentcart WHERE username = ?`
    db.query(sql, [username], (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      for (let i of result) {
        let query = `SELECT * FROM equipment WHERE eid = ?`
        db.query(query, [i.eid], (err1, result1) => {
          if (err1) throw new ExpressError(err1.message, err1.statusCode);
          // console.log(result1[0])
          totalPrice += result1[0].eprice
          equipItems.push(result1[0])
        })
      }

      let fertItems = []
      const sql1 = `SELECT * FROM fertilizerCart WHERE username = ?`
      db.query(sql1, [username], (err2, result2) => {
        if (err2) throw new ExpressError(err2.message, err2.statusCode);
        for (let i of result2) {
          let query1 = `SELECT * FROM fertilizer WHERE fid = ?`
          db.query(query1, [i.fid], (err3, result3) => {
            if (err3) throw new ExpressError(err3.message, err3.statusCode);
            totalPrice += result3[0].fprice
            fertItems.push(result3[0])
            // console.log(list)
          })
        }
        setTimeout(() => { res.render('cartItems/cartItems', { fertItems, equipItems, totalPrice }) }, 1000);
        // res.send([totalPrice])
      })
    })
  } catch (e) {
    next(e)
  }
})

// cart remove item
app.delete('/ferilizer/removeItem/:fid', requireLogin, (req, res, next) => {
  try {
    const { fid } = req.params;
    const username = req.session.username
    const sql = `DELETE FROM fertilizercart WHERE username = ? AND fid = ?`
    db.query(sql, [username, fid], (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      res.redirect('/cartItems')
    })
  } catch (e) {
    next(e)
  }
})


app.delete('/equipment/removeItem/:eid', requireLogin, (req, res, next) => {
  try {
    const { eid } = req.params;
    const username = req.session.username
    const sql = `DELETE FROM equipmentcart WHERE username = ? AND eid = ?`
    db.query(sql, [username, eid], (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      res.redirect('/cartItems')
    })
  } catch (e) {
    next(e)
  }
})


let fert
// place order
app.post('/ordersBooked', requireLogin, (req, res, next) => {
  try {
    const sql = `SELECT * FROM fertilizercart WHERE username = ? `
    db.query(sql, [req.session.username], (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      for (let fertilizer of result) {
        let sql1 = `INSERT INTO fertOrders SET ?`
        let value = {
          fid: fertilizer.fid,
          username: fertilizer.username,
          ord_date: Date().toString().slice(0, 24)
        }
        db.query(sql1, value, (err1, result1) => {
          if (err1) throw new ExpressError(err1.message, err1.statusCode)
        })
      }
    })

    const sql2 = `SELECT * FROM equipmentcart WHERE username = ? `
    db.query(sql2, [req.session.username], (err2, result2) => {
      if (err2) throw new ExpressError(err2.message, err2.statusCode);
      for (let equipment of result2) {
        let sql3 = `INSERT INTO equipOrders SET ?`
        let value = {
          eid: equipment.eid,
          username: equipment.username,
          ord_date: Date().toString().slice(0, 24)
        }
        db.query(sql3, value, (err3, result3) => {
          if (err3) throw new ExpressError(err3.message, err3.statusCode)
        })
      }
    })
    setTimeout(() => { res.render('orderSuccessfull') }, 1000)
  } catch (e) {
    next(e);
  }
})

//invoice route
app.get('/getInvoice', requireLogin, (req, res, next) => {
  try {
    const username = req.session.username;
    let userInfo = ''
    const sql = `SELECT * FROM customer WHERE username = ?`
    db.query(sql, [username], (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      userInfo = result[0]
    })

    let totalPrice = 0;
    const sql1 = `SELECT * FROM fertilizer f, fertilizercart fo WHERE f.fid = fo.fid AND fo.username = ?`
    let fertOrders = ''
    db.query(sql1, [username], (err1, result1) => {
      if (err1) throw new ExpressError(err1.message, err1.statusCode);
      for (let i of result1) {
        totalPrice += (i.fprice + 35);
      }
      fertOrders = result1;
    })

    const sql2 = `SELECT * FROM equipment e, equipmentcart eo WHERE e.eid = eo.eid AND eo.username = ?`
    let equipOrders = ''
    db.query(sql2, [username], (err2, result2) => {
      if (err2) throw new ExpressError(err2.message, err2.statusCode);
      for (let i of result2) {
        totalPrice += (i.eprice + 67);
      }
      equipOrders = result2;
    })

    const sql4 = `DELETE FROM fertilizercart WHERE username = ?`
    db.query(sql4, [req.session.username], (err4, result4) => {
      if (err4) throw new ExpressError(err4.message, err4.statusCode);
    })

    const sql5 = `DELETE FROM equipmentcart WHERE username = ?`
    db.query(sql5, [req.session.username], (err5, result5) => {
      if (err5) throw new ExpressError(err5.message, err5.statusCode);
    })

    setTimeout(() => { res.render('cartItems/invoicePage', { userInfo, fertOrders, equipOrders, totalPrice }) }, 1000)

  } catch (e) {
    next(e)
  }
})

//order history route
app.get('/getOrderHistory', requireLogin, (req, res, next) => {
  try {
    const username = req.session.username;
    let userInfo = ''
    const sql = `SELECT * FROM customer WHERE username = ?`
    db.query(sql, [username], (err, result) => {
      if (err) throw new ExpressError(err.message, err.statusCode);
      userInfo = result[0]
    })

    let totalPrice = 0;
    const sql1 = `SELECT * FROM fertilizer f, fertorders fo WHERE f.fid = fo.fid AND fo.username = ?`
    let fertOrders = ''
    db.query(sql1, [username], (err1, result1) => {
      if (err1) throw new ExpressError(err1.message, err1.statusCode);
      for (let i of result1) {
        totalPrice += (i.fprice + 35);
      }
      fertOrders = result1;
    })

    const sql2 = `SELECT * FROM equipment e, equiporders eo WHERE e.eid = eo.eid AND eo.username = ?`
    let equipOrders = ''
    db.query(sql2, [username], (err2, result2) => {
      if (err2) throw new ExpressError(err2.message, err2.statusCode);
      for (let i of result2) {
        totalPrice += (i.eprice + 67);
      }
      equipOrders = result2;
    })

    setTimeout(() => { res.render('cartItems/orderHistory', { userInfo, fertOrders, equipOrders, totalPrice }) }, 1000)

  } catch (e) {
    next(e)
  }
})


app.use('*', (req, res, next) => {
  next(new ExpressError('Page Not Found', 404))
});

app.use((err, req, res, next) => {
  const { statusCode = 500 } = err
  if (!err.message) err.message = 'Oh no, Something went wrong!'
  res.status(statusCode).render('error', { err })
});


app.listen(5000, (req, res) => {
  console.log('LISTENING TO PORT NUMBER 5000')
});