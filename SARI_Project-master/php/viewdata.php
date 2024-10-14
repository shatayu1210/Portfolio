<?php
include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'dbconn.php';

session_start();
if (isset($_SESSION['Did'])) {
  $id = $_SESSION['Did'];
} else {
  header("Location: ./login.php");
}

if(isset($_GET['uid'])){

          $uid=$_GET['uid'];

        if($uid==1){
        if(isset($_GET['key'])){
          $id=$_GET['key'];
          $query="SELECT * FROM patient WHERE pat_id=$id";
          $result=mysqli_query($con,$query);
          $row = mysqli_fetch_assoc($result);
          $gen=$row['pat_gender'];
          $distid=$row['district_id'];
          $ublockid=$row['ublock_id'];
          $mnpid=$row['mnp_id'];
          $rblockid=$row['rb_id'];
          $phcid=$row['phc_id'];
          $subid=$row['sub_id'];
          $vid=$row['v_id'];
          $patid=$row['pat_id'];
          $latitude=$row['lat'];
          $longitude=$row['lon'];
          $query6="SELECT * FROM district WHERE district_id=$distid;";
          $result6 = mysqli_query($con, $query6);
          $row6 = mysqli_fetch_assoc($result6);
          $query9="SELECT * FROM blockurban WHERE bu_id=$ublockid;";
          $result9 = mysqli_query($con, $query9);
          $row9 = mysqli_fetch_assoc($result9);
          $query10="SELECT * FROM mnpa WHERE mu_id=$mnpid;";
          $result10 = mysqli_query($con, $query10);
          $row10 = mysqli_fetch_assoc($result10);


          $query7="SELECT * FROM block WHERE b_id=$rblockid;";
          $result7 = mysqli_query($con, $query7);
          $row7 = mysqli_fetch_assoc($result7);
          $query8="SELECT * FROM phc WHERE phc_id=$phcid;";
          $result8 = mysqli_query($con, $query8);
          $row8 = mysqli_fetch_assoc($result8);
          $query11="SELECT * FROM subcenter WHERE sub_id=$subid;";
          $result11 = mysqli_query($con, $query11);
          $row11 = mysqli_fetch_assoc($result11);
          $query12="SELECT * FROM village WHERE v_id=$vid;";
          $result12 = mysqli_query($con, $query12);
          $row12 = mysqli_fetch_assoc($result12);


          $query13="SELECT * FROM travelhistory WHERE p_id=$patid;";
          $result13 = mysqli_query($con, $query13);
          $query14="SELECT * FROM travehfamily WHERE pat_id=$patid;";
          $result14 = mysqli_query($con, $query14);
          $query15="SELECT * FROM nearbypat WHERE pat_id=$patid;";
          $result15 = mysqli_query($con, $query15);


          $fev=$row['fever'];
          $cou=$row['cough'];
          $bre=$row['breath'];
          $hosdate=$row['hop_date'];
          $hyp=$row['hypertension'];
          $dia=$row['diabetes'];
          $car=$row['cardiac'];
          $res=$row['respiratory'];
          $can=$row['cancer'];
          $preg=$row['pregnant'];
          $imm=$row['immuno'];
          $travhist=$row['travelhis'];
          $travfamilyper1=$row['travelper'];
          $travlocal1=$row['housenearby'];
          if ($travlocal1==1) {
            $travlocal2="Yes";
          }else {
            $travlocal2="No";
          }
          if ($travfamilyper1==1) {
            $travfamilyper="Yes";
          }else {
            $travfamilyper="No";
          }
          if ($travhist==1) {
            $travelhistoryofpatient="Yes";
          }else {
            $travelhistoryofpatient="No";
          }
          if ($fev==1) {
            $fever="Yes";
          }else {
            $fever="No";
          }
          if ($cou==1) {
            $cough="Yes";
          }else {
            $cough="No";
          }
          if ($bre==1) {
            $breath="Yes";
          }else {
            $breath="No";
          }
          if ($hyp==1) {
            $hyper="Yes";
          }else {
            $hyper="No";
          }
          if ($dia==1) {
            $diab="Yes";
          }else {
            $diab="No";
          }
          if ($car==1) {
            $cardi="Yes";
          }else {
            $cardi="No";
          }
          if ($res==1) {
            $respi="Yes";
          }else {
            $respi="No";
          }
          if ($can==1) {
            $cancer="Yes";
          }else {
            $cancer="No";
          }
          if ($preg==1) {
            $pregnent="Yes";
          }else {
            $pregnent="No";
          }
          if ($imm==1) {
            $immuno="Yes";
          }else {
            $immuno="No";
          }

          if ($gen=1) {
            $gender="Male";
          }else {
            $gender="Female";
          }
          $area=$row['area_id'];
          if ($area==1) {
            $location="Urban";
          }else {
            $location="Rural";
          }
      }
}
}else {
  header("Location: ./dashboard.php");
}

 ?>


 <html lang="en" dir="ltr">
   <head>
     <head>
         <meta charset="utf-8">
         <meta content="width=device-width, initial-scale=1" name="viewport"/>
         <title>Details</title>
         <link rel="stylesheet" href="../css/animate.css">
         <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">
         <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
         <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
         <link rel="stylesheet" href="https://cdn.datatables.net/1.10.20/css/jquery.dataTables.min.css">
         <link rel="stylesheet" href="../css/main.css">
         <style media="screen">
           th{
             background-color: rgba(0, 182, 255, 0.6);
             color: #000;
           }
         </style>
     <link rel="icon" href="../images/bluelogo.jpg"></head>
   <link rel="icon" href="../images/bluelogo.jpg"></head>
   <body>
     <?php
       include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'header.php';
      ?><br><br><br>
       <div class="card dashcard1"style="padding:3%;"><br>
         <h2 style="text-align:center;">Details</h2><br>
         <table class="table table-bordered" style="">
           <tr>
             <th>Patient ID:</th>
             <td colspan=5><?php echo $patid; ?></td>
           </tr>
    <tr>
      <th scope="col">Patient Name</th>
      <td colspan=2><?php echo $row['pat_name']; ?></td>
      <th scope="col">Gender</th>
      <td colspan=2><?php echo $gender; ?></td>
    </tr>
    <tr>
      <th scope="col">Age</th>
      <td colspan=2><?php echo $row['pat_agey']." years & ".$row['pat_agem']." months"; ?></td>
      <th scope="col">Phone No.</th>
      <td colspan=2><?php echo $row['pat_phone']; ?></td>
    </tr>
    <tr>
      <th>District</th>
      <td colspan=2><?php echo $row6['district_name']; ?></td>
      <th>Area</th>
      <td colspan=2><?php echo $location; ?></td>
    </tr>
    <?php if ($area==1) { ?>
    <tr>
        <th>Block</th>
        <td colspan=2><?php echo $row9['bu_name']; ?></td>
        <th>Muncipal Corporation</th>
        <td colspan=2><?php echo $row10['mu_name']; ?></td>
    </tr>
  <?php }else { ?>
      <tr>
        <th>Block</th>
        <td colspan=2><?php echo $row7['b_name']; ?></td>
        <th>PHC Center</th>
        <td colspan=2><?php echo $row8['phc_name']; ?></td>
      </tr>
        <tr>
        <th>Sub Center</th>
        <td colspan=2><?php echo $row11['sub_name']; ?></td>
        <th>Village</th>
        <td colspan=2><?php echo $row12['v_name']; ?></td>
      </tr>
  <?php } ?>
    <tr>
      <th colspan=6 style="text-align:center;">SARI Symptoms</th>
    </tr>
      <tr>
      <th>Fever</th>
      <td><?php echo $fever; ?></td>
      <th>Cough</th>
      <td><?php echo $cough; ?></td>
      <th>Breathlessness</th>
      <td><?php echo $breath; ?></td>
    </tr>
    <tr>
      <th>Other SARI Symptoms</th>
      <td colspan=5><?php echo $row['sym_other']; ?></td>
    </tr>
    <tr>
      <th>Symptom Days</th>
      <td colspan=2><?php echo $row['sym_days']; ?></td>
      <th>Hospitalization Date</th>
      <td colspan=2><?php echo date('D d-m-Y', $hosdate); ?></td>
    </tr>
    <tr>
      <th colspan=6 style="text-align:center;">Co-morbid conditions of SARI patient</th>
    </tr>
    <tr>
      <th>Hypertension</th>
      <td><?php echo $hyper; ?></td>
      <th>Daibetes</th>
      <td><?php echo $diab; ?></td>
      <th>Cardiac Diseases</th>
      <td><?php echo $cardi; ?></td>
    </tr>
    <tr>
      <th>Respiratory Diseases</th>
      <td><?php echo $respi; ?></td>
      <th>Cancer</th>
      <td><?php echo $cancer; ?></td>
      <th>Pregnant</th>
      <td><?php echo $pregnent; ?></td>
    </tr>
    <tr>
      <th>ImmunoCompromised condition (HIV,Tb)</th>
      <td><?php echo $immuno; ?></td>
      <th>Other Co-morbid conditions</th>
      <td colspan=3><?php echo $row['comorbid_other']; ?></td>
    </tr>
    <tr>
      <th>Contact 1</th>
      <td colspan=2><?php echo $row['pat_contact1']; ?></td>
      <th>Contact 2</th>
      <td colspan=2><?php echo $row['pat_contact2']; ?></td>
    </tr>
    <tr>
      <th>Travel History of patient?</th>
      <td><?php echo $travelhistoryofpatient; ?></td>
      <th>Details of Travel History</th>
      <td colspan=3>
        <?php
        if ($travhist==1) {
        if (mysqli_num_rows($result13) > 0)
        {
        while ($row13 = mysqli_fetch_assoc($result13)) {
            $timetrav=$row13['trav_date'];
            $timetravekfinal=date('D d-m-Y', $timetrav);
            echo $row13['trav_place']." - ".$timetravekfinal."<br>";
        }
        }else {
        echo "None";
        }}else {
        echo "---";
        }
         ?>
      </td>
    </tr>
    <tr>
      <th>Travel History of Family?</th>
      <td colspan=2><?php echo $travfamilyper; ?></td>
      <th>If Yes, How many Persons?</th>
      <td colspan=2><?php echo $row['no_travelper']; ?></td>
    </tr>
    <tr>
      <th>Details of Travel History</th>
      <td colspan=5>
        <?php
        if ($travfamilyper1==1) {
        if (mysqli_num_rows($result14) > 0)
        {
        while ($row14 = mysqli_fetch_assoc($result14)) {
            $timetrav=$row14['travf_date'];
            $timetravekfinal=date('D d-m-Y', $timetrav);
            echo $row14['travf_place']." - ".$timetravekfinal."<br>";
        }
      }else {
        echo "None";
      }}else {
        echo "---";
      }
      ?>
      </td>
    </tr>
    <tr>
      <th>Is in that area nearby 50 houses having ILI/SARI cases?</th>
      <td colspan=2><?php echo $travlocal2; ?></td>
      <th>If Yes, How many Persons?</th>
      <td colspan=2><?php echo $row['house_cases']; ?></td>
    </tr>
    <tr>
      <th>Details of people</th>
      <td colspan=5>
        <?php
        if ($travlocal1==1) {
        if (mysqli_num_rows($result15) > 0)
        {
        while ($row15 = mysqli_fetch_assoc($result15)) {
             $nearpatgender=$row15['nearpat_age'];
             if ($nearpatgender==1) {
               $nearpatgender1="Male";
             }else {
               $nearpatgender1="Female";
             }
            echo $row15['nearpat_name']." - ".$row15['nearpat_age']." - ".$nearpatgender1."<br>";
        }
      }else {
        echo "None";
      }}else {
        echo "---";
      }
      ?>
      </td>
    </tr>
    <tr>
      <th>Latitude</th>
      <td colspan=2><?php echo $latitude; ?></td>
      <th>Longitude</th>
      <td colspan=2><?php echo $longitude ?></td>
    </tr>
  </tbody>
</table><br><br>
<iframe width="100%" height="500px" src="https://maps.google.com/maps?q=<?php echo $longitude; ?>,<?php echo $latitude; ?>&output=embed"></iframe>
<br><br><br><br>
       </div>
       <br><br><br><br>
       <?php
         include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'footer.php';
        ?>

        <script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js" integrity="sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1" crossorigin="anonymous"></script>
        <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>

   </body>
 </html>
