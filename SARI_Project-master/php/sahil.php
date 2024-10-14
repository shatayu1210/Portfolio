<?php
session_start();
include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'dbconn.php';
// include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'check.php';

    $buid = $_REQUEST['m_id'];

    // echo $buid;
    echo "hi"
    // $sqlbl = "SELECT * FROM mnpa WHERE  bu_id = '".$buid."'";
    // $resultbl = mysqli_query($con,$sqlbl);
    // echo "<label for='mnoa'>Municipal Corporation:</label>
    //     <select name='mnpa' id='mnpa' class='form-control' onChange='sahil(this.value)>";
    // echo " <option disabled selected value>Select Municipal Corporation</option> ";
    // if (mysqli_num_rows($resultbl) > 0)
    // {
    //     while ($rowbl = mysqli_fetch_assoc($resultbl))
    // {
    //     echo "<option value='".$rowbl['mu_id']."'>".$rowbl['mu_name']."</option>";
    // }
    // }
    // echo "</select><br>";
    


?>
