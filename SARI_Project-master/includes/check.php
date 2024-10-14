<?php
if(!$_SESSION['userid'] )
{
  
	header('Location: googlelogin.php');
}
?>