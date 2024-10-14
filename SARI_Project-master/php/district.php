<?php
include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'dbconn.php';

session_start();
if (isset($_SESSION['Aid'])) {
  $id = $_SESSION['Aid'];
} else {
  header("Location: ./ashaworkerslogin.php");
}

$did = $_REQUEST['d_id'];
// $sqlbl = "SELECT * FROM phc WHERE b_id = '".$did."'";
// $resultbl = mysqli_query($con,$sqlbl);
echo "<label for='area'>Area:</label>
<select name='area' id='area' class='form-control' onChange='get_area(this.value)'>";
echo " <option disabled selected value>Select Area</option> ";
    echo "<option value='0'>Rural</option>";
    echo "<option value='1'>Urban</option>";
echo "</select><br>";

?>
