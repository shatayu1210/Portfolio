<?php
include dirname(dirname(__FILE__)) . DIRECTORY_SEPARATOR . 'includes' . DIRECTORY_SEPARATOR . 'dbconn.php';
/*if (isset($_POST['surveycompleted']))
{*/

    $long123 = mysqli_real_escape_string($con, $_POST['long']);
    $lat123 = mysqli_real_escape_string($con, $_POST['lat']);

    $district = mysqli_real_escape_string($con, $_POST['dist']);
    $area = mysqli_real_escape_string($con, $_POST['rate']);
    $patname = mysqli_real_escape_string($con, $_POST['pname']);
    $patgender = mysqli_real_escape_string($con, $_POST['optradiopgen']);
    $ageyear = mysqli_real_escape_string($con, $_POST['pageyears']);
    $agemonth = mysqli_real_escape_string($con, $_POST['pagemonths']);
    $patphone = mysqli_real_escape_string($con, $_POST['patnumber']);

    /*echo $long123;
    exit;*/
    if (!empty($_POST["pccontact1"]))
        $patphone1 = mysqli_real_escape_string($con, $_POST['pccontact1']);
    else
        $patphone1 = " ";

    if (!empty($_POST["pccontact2"]))
        $patphone2 = mysqli_real_escape_string($con, $_POST['pccontact2']);
    else
        $patphone2 = " ";

    if (isset($_POST['fever']))
        $pever = mysqli_real_escape_string($con, $_POST['fever']);
    else
        $pever = 0;

    if (isset($_POST['cough']))
        $pcough = mysqli_real_escape_string($con, $_POST['cough']);
    else
        $pcough = 0;

    if (isset($_POST['breathlessness']))
        $pbreath = mysqli_real_escape_string($con, $_POST['breathlessness']);
    else
        $pbreath = 0;

    if (!empty($_POST["othersymptoms"]))
        $othersymp = mysqli_real_escape_string($con, $_POST['othersymptoms']);
    else
        $othersymp = " ";

    $sydays = mysqli_real_escape_string($con, $_POST['sympdays']);
    $datehop = mysqli_real_escape_string($con, $_POST['hpdate']);
    $time123 = explode(',', $datehop);
    $date1 = explode('-', $datehop);
    $month = $date1[1];
    $day = $date1[2];
    $year = $date1[0];
    $hour = 9;
    $minu = 0;
    $dateStr = "$month" . "/" . $day . "/" . "$year";
    $timeStr = "$hour" . ":" . "$minu" . ":00";
    list($hours, $minu) = explode(':', $timeStr);

    $dateTime = DateTime::createFromFormat('m/d/Y', $dateStr)->setTime($hours, $minu);
    $timeStampdate = $dateTime->getTimestamp();

    if (isset($_POST['Hypertension']))
        $hyper = mysqli_real_escape_string($con, $_POST['Hypertension']);
    else
        $hyper = 0;

    if (isset($_POST['Diabetes']))
        $diab = mysqli_real_escape_string($con, $_POST['Diabetes']);
    else
        $diab = 0;

    if (isset($_POST['Cardiac']))
        $cardic = mysqli_real_escape_string($con, $_POST['Cardiac']);
    else
        $cardic = 0;

    if (isset($_POST['Respiratory']))
        $resp = mysqli_real_escape_string($con, $_POST['Respiratory']);
    else
        $resp = 0;

    if (isset($_POST['Cancer']))
        $cancer = mysqli_real_escape_string($con, $_POST['Cancer']);
    else
        $cancer = 0;

    if (isset($_POST['Pregnant']))
        $preg = mysqli_real_escape_string($con, $_POST['Pregnant']);
    else
        $preg = 0;

    if (isset($_POST['otherimmuno']))
        $otherimm = mysqli_real_escape_string($con, $_POST['otherimmuno']);
    else
        $otherimm = 0;

    if (!empty($_POST["otherconditionscomorbid"]))
        $othercondition = mysqli_real_escape_string($con, $_POST['otherconditionscomorbid']);
    else
        $othercondition = " ";

    if ($area == "Rural")
    {
        $a = 0;
        $ublock = 0;
        $umnp = 0;
        $rblock = mysqli_real_escape_string($con, $_POST['block']);
        $rphc = mysqli_real_escape_string($con, $_POST['phc']);
        $rsubcenter = mysqli_real_escape_string($con, $_POST['subcenter']);
        $rvillage = mysqli_real_escape_string($con, $_POST['village']);
    }
    else
    {
        $a = 1;
        $rblock = 0;
        $rphc = 0;
        $rsubcenter = 0;
        $rvillage = 0;
        $ublock = mysqli_real_escape_string($con, $_POST['block']);
        $umnp = mysqli_real_escape_string($con, $_POST['mnpa']);
    }

    $travhis = mysqli_real_escape_string($con, $_POST['travelhis']);

    $travelper = mysqli_real_escape_string($con, $_POST['travelper']);

    if ($travelper == 1)
        $patienttravel = mysqli_real_escape_string($con, $_POST['nopatientstravel']);
    else
        $patienttravel = 0;

    $nearby = mysqli_real_escape_string($con, $_POST['nearby']);

    if ($nearby == 1)
        $patient1 = mysqli_real_escape_string($con, $_POST['nopatients1']);
    else
        $patient1 = 0;

    $currenttime = time();
    $query4 = "INSERT INTO `patient`(`district_id`, `area_id`, `ublock_id`, `mnp_id`, `rb_id`, `phc_id`, `sub_id`, `v_id`, `pat_name`, `pat_gender`, `pat_agey`, `pat_agem`, `pat_phone`, `fever`, `cough`, `breath`, `sym_other`, `sym_days`, `hop_date`, `hypertension`, `diabetes`, `cardiac`, `respiratory`, `cancer`, `pregnant`, `immuno`, `comorbid_other`, `travelhis`, `travelper`, `no_travelper`, `housenearby`, `house_cases`, `pat_contact1`, `pat_contact2`, `lat`, `lon`, `timestamp`) VALUES ($district,$a,$ublock,$umnp,$rblock,$rphc,$rsubcenter,$rvillage,'$patname',$patgender,$ageyear,$agemonth,$patphone,$pever,$pcough,$pbreath,'$othersymp',$sydays,$timeStampdate,$hyper,$diab,$cardic,$resp,$cancer,$preg,$otherimm,'$othercondition',$travhis,$travelper,$patienttravel,$nearby,$patient1,'".$patphone1."','".$patphone2."','".$long123."','".$lat123."','".$currenttime."');";

    //echo $query4;
    $result4 = mysqli_query($con, $query4);
    $query451 = "SELECT `pat_id` FROM `patient` WHERE pat_phone=$patphone && timestamp=$currenttime";
    $result451 = mysqli_query($con, $query451);
    $row451 = mysqli_fetch_assoc($result451);
    $patientuniID = $row451['pat_id'];

    if ($travhis == 1)
    {
        if (!empty($_POST["place"]) && !empty($_POST["date1"]))
        {
            $name = $_POST["place"];
            $material = $_POST["date1"];
            if (count($name) == count($material))
            {
                for ($i = 0;$i < count($name);$i++)
                {

                    $time123 = explode(',', $material[$i]);
                    $date1 = explode('-', $material[$i]);
                    $month = $date1[1];
                    $day = $date1[2];
                    $year = $date1[0];
                    $hour = 9;
                    $minu = 0;
                    $dateStr = "$month" . "/" . $day . "/" . "$year";
                    $timeStr = "$hour" . ":" . "$minu" . ":00";
                    list($hours, $minu) = explode(':', $timeStr);

                    $dateTime = DateTime::createFromFormat('m/d/Y', $dateStr)->setTime($hours, $minu);
                    $materialdate = $dateTime->getTimestamp();

                    $query45 = "INSERT INTO `travelhistory`(`p_id`, `trav_place`, `trav_date`) VALUES ($patientuniID,'$name[$i]',$materialdate)";
                    //echo "$query45";
                    mysqli_query($con, $query45);
                }
            }
        }
    }

    if ($travelper == 1)
    {
        if (!empty($_POST["place2"]) && !empty($_POST["date2"]))
        {
            $name = $_POST["place2"];
            $material = $_POST["date2"];
            if (count($name) == count($material))
            {
                for ($i = 0;$i < count($name);$i++)
                {
                    $time123 = explode(',', $material[$i]);
                    $date1 = explode('-', $material[$i]);
                    $month = $date1[1];
                    $day = $date1[2];
                    $year = $date1[0];
                    $hour = 9;
                    $minu = 0;
                    $dateStr = "$month" . "/" . $day . "/" . "$year";
                    $timeStr = "$hour" . ":" . "$minu" . ":00";
                    list($hours, $minu) = explode(':', $timeStr);

                    $dateTime = DateTime::createFromFormat('m/d/Y', $dateStr)->setTime($hours, $minu);
                    $materialdate12 = $dateTime->getTimestamp();
                    $query45 = "INSERT INTO `travehfamily`(`pat_id`, `travf_place`, `travf_date`) VALUES ($patientuniID,'$name[$i]',$materialdate12)";
                    mysqli_query($con, $query45);
                }
            }
        }
    }

    if ($nearby == 1)
    {
        $patient1 = mysqli_real_escape_string($con, $_POST['nopatients1']);
        if (!empty($_POST["name3"]) && !empty($_POST["age3"]) && !empty($_POST["sex3"]))
        {
            $name = $_POST["name3"];
            $material = $_POST["age3"];
            $sex3 = $_POST["sex3"];
            if (count($name) == count($material))
            {
                for ($i = 0;$i < count($name);$i++)
                {
                    $query45 = "INSERT INTO `nearbypat`(`pat_id`, `nearpat_name`, `nearpat_age`, `nearpat_gender`) VALUES ($patientuniID,'$name[$i]',$material[$i],$sex3[$i])";
                    mysqli_query($con, $query45);
                }
            }
        }
    }



echo "Data inserted successfully";
  header("Location: ./index.php");
/*}else{
    echo "No data";
}*/
?>
