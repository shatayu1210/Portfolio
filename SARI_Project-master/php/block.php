<?php
include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'dbconn.php';

session_start();
if (isset($_SESSION['Aid'])) {
  $id = $_SESSION['Aid'];
} else {
  header("Location: ./ashaworkerslogin.php");
}

$did = $_REQUEST['d_id'];
$sqlbl = "SELECT * FROM block WHERE district_id = '".$did."'";
$resultbl = mysqli_query($con,$sqlbl);
echo "<label for='block'>Block:</label>
<select name='block' id='block' class='form-control'  onChange='get_phc(this.value)'>";
echo " <option disabled selected value='0'>Select Block</option> ";
if (mysqli_num_rows($resultbl) > 0)
{
    while ($rowbl = mysqli_fetch_assoc($resultbl))
{
    echo "<option value='".$rowbl['b_id']."'>".$rowbl['b_name']."</option>";
}
}
echo "</select><br>";

?>
