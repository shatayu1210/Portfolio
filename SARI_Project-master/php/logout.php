<?php
session_start();

  if ($_SESSION['logintype']==1) {
session_unset();
  session_destroy();
   header("Location: ./login.php");
  }

  if ($_SESSION['logintype']==2) {
session_unset();
  session_destroy();
   header("Location: ./ashaworkerslogin.php");
  }

?>
