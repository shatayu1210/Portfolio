<?php

session_start();


if(isset($_GET['logout-submit']) && $_GET['logout-submit'] == 'logout'){
    session_destroy(); 
 


  header("Cache-Control: no-cache, must-revalidate");
  header("Expires: Mon, 26 Jul 1997 05:00:00 GMT");
  header("Content-Type: application/xml; charset=utf-8");
  
  

	header('Location: ../php/googlelogin.php');
  // document.location = '../pages-login-2.php';
  echo "<script type='text/javascript'>localStorage.clear() </script>";

  }
?>