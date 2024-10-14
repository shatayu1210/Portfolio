<?php
include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'dbconn.php';

session_start();
if (isset($_SESSION['Aid'])) {
  $id = $_SESSION['Aid'];
} else {
  header("Location: ./login.php");
}


$blockid = $_REQUEST['b_id'];
$sqlbl = "SELECT * FROM phc WHERE b_id = '".$blockid."'";
$resultbl = mysqli_query($con,$sqlbl);
echo "<label for='phc'>PHC:</label>
<select name='phc' id='phc' class='form-control' onChange='get_subcenter(this.value)'>";
echo " <option disabled selected value>Select PHC</option> ";
if (mysqli_num_rows($resultbl) > 0)
{
    while ($rowbl = mysqli_fetch_assoc($resultbl))
{
    echo "<option value='".$rowbl['phc_id']."'>".$rowbl['phc_name']."</option>";
}
}
echo "</select><br>";

?>
