<?php
include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'dbconn.php';

session_start();
if (isset($_SESSION['Aid'])) {
  $id = $_SESSION['Aid'];
} else {
  header("Location: ./ashaworkerslogin.php");
}
$phcid = $_REQUEST['phc_id'];
// echo "$phcid";
$sqlbl = "SELECT * FROM subcenter WHERE phc_id = '".$phcid."'";
$resultbl = mysqli_query($con,$sqlbl);
echo "<label for='subcenter'>Sub Center:</label>
<select name='subcenter' id='subcenter' class='form-control' onChange='get_village(this.value)'>>";
echo "<option disabled selected value>Select Sub-Center</option> ";
if (mysqli_num_rows($resultbl) > 0)
{
    while ($rowbl = mysqli_fetch_assoc($resultbl))
    {
      echo "<option value='".$rowbl['sub_id']."'>".$rowbl['sub_name']."</option>";
    }
}
echo "</select><br>";

?>
