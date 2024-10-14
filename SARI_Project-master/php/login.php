
<?php
include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'dbconn.php';
session_start();
if(isset($_SESSION['logintype'])){
  if ($_SESSION['logintype']==1) {
   header("Location: ./dashboard.php");
  }
  if ($_SESSION['logintype']==2) {
   header("Location: ./index.php");
  }
}

if (isset($_POST['dashboardsigin'])) {
  if (isset($_POST['username']) && !empty($_POST['username'])) {
      $mail = mysqli_real_escape_string($con,trim($_POST['username']));
      $query = "SELECT * FROM district_login WHERE d_username='$mail'";
      $result = mysqli_query($con, $query);

  } else {
     header("Location: ./login.php");
  }
  if (isset($_POST['u_password']) && !empty($_POST['u_password'])) {
      $password = mysqli_real_escape_string($con,trim($_POST['u_password']));
  } else {
     header("Location: ./login.php");
  }
if (mysqli_num_rows($result) > 0) {
  $row = mysqli_fetch_assoc($result);
  $id = $row['dl_id'];
  $pass = $row['d_password'];
}
else {
  header("Location: ./login.php");
}


  if (password_verify($password, $pass)) {
    $_SESSION['Did'] = $id;
    $_SESSION['logintype'] = "1";
   header("Location: ./dashboard.php");
  } else {
    header("Location: ./login.php");
  }
}
 ?>
<html lang="en" dir="ltr">
<head>
    <meta charset="utf-8">
      <meta content="width=device-width, initial-scale=1" name="viewport"/>
    <title>Login Page</title>
    <link rel="stylesheet" href="../css/animate.css">
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.datatables.net/1.10.20/css/jquery.dataTables.min.css">
    <link rel="stylesheet" href="../css/main.css">
    <link rel="stylesheet" href="../css/footer.css">
    <style>
    /*Nav*/


    /*Input Box Styles*/
    input[type="email"],
    input[type="password"] {
    border: 0;
    background: none;
    display: block;
    margin: 20px auto;
    text-align: center;
    border: 2px solid #00b6ff;
    padding: 14px 10px;
    width: 250px;
    outline: none;
    color: black;
    border-radius: 24px;
    transition: 0.25s;
    }

    input[type="email"],
    input[type="password"]:hover {
        cursor: text;
    }

    input[type="email"]:focus,
    input[type="password"]:focus {
    width: 340px;
    }

    input:focus::placeholder {
    color: transparent;
    }

    .forgotpassword {
    color: #00b6ff;
    text-decoration: underline;
    }

    @media (max-width: 860px) {
        .logincard {
            width:60%
        }
    }

    @media (max-width: 770px) {
        .logincard {
            width:70%
        }
    }

    @media (max-width: 580px) {
        input[type="email"],
        input[type="password"] {
        width: 220px;
        }
        input[type="email"]:focus,
        input[type="password"]:focus {
        width: 270px;
    }
        .logincard {
            width:80%
        }
    }

    @media (max-width: 460px) {
        .logincard {
            width:90%
        }
    }

    @media (max-width: 400px) {
        .logincard {
            width:95%
        }
    }

    @media (max-width: 380px) {
        input[type="email"],
        input[type="password"] {
        width: 200px;
        }
        input[type="email"]:focus,
        input[type="password"]:focus {
        width: 250px;
    }
    }

    @media (max-width: 300px) {
        input[type="email"],
        input[type="password"] {
        width: 180px;
        }
        input[type="email"]:focus,
        input[type="password"]:focus {
        width: 230px;
    }
    }

    </style>
    <link rel="icon" href="../images/bluelogo.jpg">
</head>
<body>
  <!--Nav Bar-->
  <?php
     include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'header.php';
    ?>
  <!--Content-->
    <br><br><br>
    <div class="card logincard animated jackInTheBox">
        <form class="" action="" method="post">
        <h3 style="text-align: center; font-weight: 800">Data Login</h3><br>
                <div class="input-field">
                <input type="email" name="username" id="u_name" placeholder="Username" required/>
                </div>
                <div class="input-field">
                <input type="password" id="upass" name="u_password" placeholder="Password" required/>
                </div><br>
                    <div class="text-center">
                <input type="submit" style="width: 120px;height: 40px;" name="dashboardsigin" value="Login"class="btn btn2"/>
                <br><br>
              </div><br>
                </form>

                <br>
            </div>
    </div>
  <!--Footer-->
  <?php
    include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'footer.php';
   ?>>
<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js" integrity="sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1" crossorigin="anonymous"></script>
<script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>
<script src="https://code.jquery.com/jquery-3.3.1.js"></script>
</body>
</html>
