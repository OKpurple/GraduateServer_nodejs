var express = require('express');
var utils = require('../utils.js');
var bcrypt =require('bcrypt-nodejs'); //암호화
var jwt = require('jsonwebtoken');
var router = express.Router();
var fs = require('fs');
var multer = require('multer');
const TOKEN_KEY = "jwhtoken"


var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'files/profiles')
    },
    filename: function(req, file, cb) {
        cb(null, req.authorizationId +'-'+req.params.create_at+ '-' + 'profile.png')
    }
})



router.get('/:userId/info',(req,res)=>{
  var user_id = req.params.userId;
  console.log(":userId/info" + user_id + "정보 보기");
  utils.dbConnect(res).then((conn)=>{
    utils.query(conn,res,`SELECT * FROM user_info WHERE user_id =?`,[user_id]).then((result)=>{
      conn.release()
      if(result === 0 ){
        res.json({
          meta : {
            code : -30,
            message : "없는 회원"
          }
        })
      }else{
        res.json(utils.toRes(utils.SUCCESS,{
          data : result
        }))
      }


    })

  })

})



//회원 등록
router.post('/regist',(req,res)=>{
      var login_id = req.body.login_id;
      var login_pw = req.body.login_pw;
      let reEnterPassword = req.body.reEnterpw;
      var user_name = req.body.user_name;
      var public_range = req.body.public_range;


      let salt = bcrypt.genSaltSync(10);
      let passwordHash = bcrypt.hashSync(login_pw,salt);
        console.log(login_id + "regist")
      if (   login_pw=== undefined ||
           login_id === undefined ) {
        return res.status(400).json(utils.INVALID_REQUEST);
      }

      if(login_pw !== reEnterPassword){
        return res.status(400).json(
                {
                    meta: {
                        code: -26,
                        message: "비밀번호와 비밀번호 확인이 일치하지 않습니다."
                    }
                }
        );
    }

      utils.dbConnect(res).then((connection)=>{
        //id 중복검사
        utils.query(connection,res,
          'SELECT login_id from user_info WHERE login_id = ? ',[login_id]).then(result=>{
            if(result.length>0){
              connection.release();
              return res.status(400).json(utils.toRes(
                {
                  mata:{
                    code : -29,
                    message : "이미 존재하는 아이디"
                  }
                }
              ))
            }else{
            utils.query(connection,res,
            'INSERT INTO user_info(login_id, login_pw, user_name,public_range) VALUES (?,?,?,?)',
            [
              login_id,
              passwordHash,
              user_name,
              public_range
            ]
          ).then((registResult)=>{
            res.send(utils.toRes(utils.SUCCESS));
            connection.release();
          })}
          })
      })
})




//로그인
router.post('/login',(req,res)=>{
  var login_id = req.body.login_id;
  var login_pw = req.body.login_pw;


  console.log(login_id+` login`);
  if(login_id===undefined){
    return res.status(400).json(utils.toRes(utils.INVALID_REQUEST));
  }

  utils.dbConnect(res).then((connection)=>{
    utils.query(connection,res,
    'SELECT login_id,login_pw,user_id from user_info WHERE login_id = ?',[login_id]).then((result)=>{
      if(result.length === 0){
        connection.release();
          return res.status(400).json(
            {
              meta : {
                code:-31,
                message:"없는 id"
              }
            }
        )
      }
      else{
        let passwordResult = bcrypt.compareSync(login_pw, result[0].login_pw);
        if(passwordResult){
          let payload = { user_id : result[0].user_id }
          let token = jwt.sign(payload,TOKEN_KEY,{
                        algorithm : 'HS256', //"HS256", "HS384", "HS512", "RS256", "RS384", "RS512" default SHA256
                        expiresIn : '720H'// 5 days
                    });
          connection.release();
          return res.status(200).json(utils.toRes(utils.SUCCESS,
          {
	      user_id : result[0].user_id,
              token : token
          }
        ));

        }else{
        //비밀번호 불일치
        connection.release();
          return res.status(400).json(
            {
              meta:{
                code:-32,
                message:"비밀번호 불일치"
              }
            }
          )

        }
      }
    })
  })
})
//로그아웃
router.delete('/:user_id',(req,res)=>{
  let token = req.headers.authorization;
  let decoded = jwt.verify(token, TOKEN_KEY);
    console.log(`logout`);
  try{
  utils.dbConnect(res).then((conn)=>{
    utils.query(conn,res,`INSERT INTO Invalid_token(Invalid_token,expired_to) VALUES(?,FROM_UNIXTIME(?))`,[token,decoded.exp])
    .then((insertRes)=>{
      conn.release()
      res.json(utils.toRes(utils.SUCCESS));
    })
  })
  }catch(err){
    res.json(utils.toRes(utils.SUCCESS));
  }

})

//내 정보
router.get('/my',(req,res)=>{

  let user_id = req.authorizationId;
  console.log(user_id);
  console.log(`users/my`+user_id + '내글보기 업데이트')
  utils.dbConnect(res).then((connection)=>{
    utils.query(connection,res,
    'SELECT * from user_info WHERE user_id = ?',[user_id]).then((result)=>{
      if(result.length === 0 ){
        connection.release();
        res.status(400).json(utils.toRes(utils.INVALID_REQUEST,
          {
            message : "없는 ID"
          }
      ))}
      else{
        connection.release();
        res.status(200).json(utils.toRes(utils.SUCCESS,
          {
            data : result
          }
      ));
    };
    })
  })
})



//프로필 업데이트
var upload = multer({
    storage: storage
}).single('userprofile');
router.post('/profile', (req, res) => {
    let user_id = req.authorizationId;
    var crdate = utils.getTimeDate();
    var crtime = utils.getTimeTime();
    var trimCreateAt = crdate + crtime;
    req.params.create_at = trimCreateAt;
    console.log(user_id + "ㅍ프로필 업데이트")
    upload(req, res, (err) => {

        var profile_dir = 'http://13.124.115.238:8080/profiles/' + user_id + "-"+trimCreateAt+ "-" + 'profile.png';


        utils.dbConnect(res).then((conn)=>{
          utils.query(conn,res,`UPDATE user_info SET profile_dir = ? WHERE user_id =?`,[profile_dir,user_id]).then((result)=>{
            connection.release();
            res.json(utils.toRes(utils.SUCCESS));
          })
        })
    })
})






// post 유저의 위치 업데이트
router.post('/position', function(req, res) {

    var user_id = req.authorizationId
    var latitude = req.body.lat;
    var longitude = req.body.lng;

    console.log(user_id + '위치 업데이트'+latitude + ','+longitude);

    utils.dbConnect(res).then((connection)=>{
      utils.query(connection,res,`SELECT * from user_posi WHERE user_id = ?`,[user_id])
      .then((selectRes)=>{
        if(selectRes.length === 0){
          utils.query(connection,res,`INSERT INTO user_posi(lat,lng, user_id) VALUES (?,?,?)`,
          [latitude,longitude,user_id]).then((insertRes)=>{
            connection.release();
            return res.json(utils.toRes(utils.SUCCESS,
              {
                data : insertRes
              }
            ))
          });
        }else{
          utils.query(connection,res,`UPDATE user_posi SET lat = ? , lng = ? WHERE user_id = ?`,
            [latitude,longitude,user_id]).then((updateRes)=>{
              connection.release();
                return res.json(utils.toRes(utils.SUCCESS,
                  {
                    data : updateRes
                  }
                ));

            })
        }
      })
    })
  })

  //모든유저
  router.get('/', (req,res) =>{
      console.log(`users/ 모든유저보기`)
    utils.dbConnect(res).then((connection)=>{
      utils.query(connection,res,
        `SELECT * FROM user_info`)
         .then((result)=>{
           connection.release();
           res.status(200).json(utils.toRes(utils.SUCCESS,
             {
              usersCount : result.length,
              users : result
            }
           ));
         });
    })
  });


//  router.get('/id',(req,res)=>{
//
//   user_id = req.authorizationId;
//   utils.dbConnect(res).then((connection)=>{
//    utils.query(connection , res,
// 	`SELECT * FROM user_info WHERE user_id = ?`,[user_id]).then((result)=>{
// 	if(result.length===0){
//     connection.release();
// 	res.json(utils.INVALID_REQUEST);
// 	}else{
//     connection.release();
// 	res.json(utils.toRes(utils.SUCCESS,{
// 		data : result
// 	}))
// 	}
// })
// })
// })




module.exports = router;
