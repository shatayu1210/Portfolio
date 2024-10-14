<?php
include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'dbconn.php';

session_start();
if (isset($_SESSION['Aid'])) {
  $id = $_SESSION['Aid'];
} else {
  header("Location: ./ashaworkerslogin.php");
}

$phcid = $_REQUEST['v_id'];
// echo "$phcid";
$sqlbl = "SELECT * FROM village WHERE phc_id = '".$phcid."'";
$resultbl = mysqli_query($con,$sqlbl);
echo "<label for='village'>Village:</label>
<select class='form-control' id='village'name='village'>";
echo "<option disabled selected value>Select Village</option> ";
if (mysqli_num_rows($resultbl) > 0)
{
    while ($rowbl = mysqli_fetch_assoc($resultbl))
{
    echo "<option value='".$rowbl['v_id']."'>".$rowbl['v_name']."</option>";
}
}
echo "</select><br>";

?>
