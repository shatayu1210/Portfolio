<?php
include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'dbconn.php';

session_start();
if (isset($_SESSION['Aid'])) {
  $id = $_SESSION['Aid'];
} else {
  header("Location: ./ashaworkerslogin.php");
}
$uid = $_REQUEST['u_id'];
$sqlbl = "SELECT * FROM blockurban WHERE district_id = '".$uid."'";
$resultbl = mysqli_query($con,$sqlbl);
echo "<label for='block'>Block:</label>
<select name='block' id='block' class='form-control' onChange='get_mnpa(this.value)'>";
echo " <option disabled selected value='0'>Select Block</option> ";
if (mysqli_num_rows($resultbl) > 0)
{
    while ($rowbl = mysqli_fetch_assoc($resultbl))
{
    echo "<option value='".$rowbl['bu_id']."'>".$rowbl['bu_name']."</option>";
}
}
echo "</select><br>";

?>
