<?php
include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'dbconn.php';
$password="asha123";
$hashed_pwd = password_hash($password, PASSWORD_DEFAULT);
// $query="INSERT INTO `district_login`(`d_username`, `d_password`) VALUES ('ritesh.sandbhor@somaiya.edu','$hashed_pwd') ";
$query="INSERT INTO `ashaworkers`(`ashamail`, `ashapassword`) VALUES ('ashaworkers@gmail.com','$hashed_pwd')";
echo $query;
mysqli_query($con,$query);
 ?>
