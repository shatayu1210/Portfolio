<?php
include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'dbconn.php';

session_start();
if (isset($_SESSION['Did'])) {
  $id = $_SESSION['Did'];
} else {
  header("Location: ./login.php");
}



if (isset($_POST['extracttotalpdf'])) {
  $distid=mysqli_real_escape_string($con,$_POST['dist']);
  $date1 = explode('-', mysqli_real_escape_string($con,$_POST['date1']));
               $month = $date1[1];
                $day   = $date1[2];
               $year  = $date1[0];
               $hour=00;
               $minu=00;
               $dateStr = "$month"."/".$day."/"."$year";
               $timeStr = "$hour".":"."$minu".":00";
               list($hours, $minu) = explode(':', $timeStr);
               $dateTime = DateTime::createFromFormat('m/d/Y', $dateStr)->setTime($hours, $minu);
               $timeStamp = $dateTime->getTimestamp();

               $date2 = explode('-',mysqli_real_escape_string($con, $_POST['date2']));
               $month2 = $date2[1];
               $day2   = $date2[2];
               $year2  = $date2[0];
               $hour2=23;
               $minu2=59;
               $dateStr2 = "$month2"."/".$day2."/"."$year2";
               $timeStr2 = "$hour2".":"."$minu2".":00";
               list($hours2, $minu2) = explode(':', $timeStr2);
               $dateTime = DateTime::createFromFormat('m/d/Y', $dateStr2)->setTime($hours2, $minu2);
               $timeStamp2 = $dateTime->getTimestamp();

               $query4="SELECT * FROM patient WHERE district_id=$distid  && timestamp BETWEEN $timeStamp AND $timeStamp2 ORDER BY timestamp DESC;";
               // echo $query4;
               $result4 = mysqli_query($con, $query4);
               //$row4= mysqli_num_rows($result4);


}


 ?>
<html lang="en" dir="ltr">
  <head>
    <link rel="stylesheet" href="../css/main.css">
      <meta content="width=device-width, initial-scale=1" name="viewport"/>
    <link rel="stylesheet" href="https://cdn.datatables.net/1.10.20/css/jquery.dataTables.min.css">
    <link rel="stylesheet" href="https://cdn.datatables.net/buttons/1.6.1/css/buttons.dataTables.min.css">
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
    <title>SAARI DATA</title>
    <style media="screen">
    body {
        overflow-x: hidden;
        background-image: url("../images/backk.jpg");
        background-repeat: repeat-y;
        background-size: 100% auto;
    }

    </style>
  <link rel="icon" href="../images/bluelogo.jpg"></head>
  <body><?php
    include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'header.php';
   ?><br><br><br>
    <div class="card dashcard1"style="padding:3%;">
    <table id="example" class="display" style="width:90%;margin:auto;">
        <thead>
            <tr>
                <th>Name</th>
                <th>Gender</th>
                <th>Age</th>
                <th>Phone No.</th>
                <th>Fever</th>
                <th>Cough</th>
                <th>Breathlessness</th>
                <th>Other Symptoms</th>
                <th>Symptoms (in Days)</th>
                <th>Hospitalization</th>
                <th>Hypertension</th>
                <th>Diabetes</th>
                <th>Cardiac Diseases</th>
                <th>Respiratory Diseases</th>
                <th>Cancer</th>
                <th>Pregnant</th>
                <th>ImmunoCompromised condition (HIV,Tb)</th>
                <th>Other Co-morbid conditions</th>
                <th>Any Travel History</th>
                <th>Traveled Places</th>
                <th>Family member traveled</th>
                <th>No. of Family member traveled</th>
                <th>Family member details</th>
                <th>Locality Member infected</th>
                <th>No. of Locality Member infected</th>
                <th>Locality member details</th>
                <th>Contact Details</th>
            </tr>
        </thead>
        <tbody>
          <?php
          if (mysqli_num_rows($result4) > 0)
          {
          while ($row4 = mysqli_fetch_assoc($result4)) {
            $patid=$row4['pat_id'];
            $query5="SELECT * FROM travelhistory WHERE p_id=$patid;";
            $result5 = mysqli_query($con, $query5);
            $query6="SELECT * FROM travehfamily WHERE pat_id=$patid;";
            $result6 = mysqli_query($con, $query6);
            $query7="SELECT * FROM nearbypat WHERE pat_id=$patid;";
            $result7 = mysqli_query($con, $query7);
            $gen=$row4['pat_gender'];
            $fev=$row4['fever'];
            $cou=$row4['cough'];
            $bre=$row4['breath'];
            $hosdate=$row4['hop_date'];
            $hyp=$row4['hypertension'];
            $dia=$row4['diabetes'];
            $car=$row4['cardiac'];
            $res=$row4['respiratory'];
            $can=$row4['cancer'];
            $preg=$row4['pregnant'];
            $imm=$row4['immuno'];
            $travhist=$row4['travelhis'];
            $travfamilyper1=$row4['travelper'];
            $travlocal1=$row4['housenearby'];
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
            if ($gen==1) {
              $gender="Male";
            }else {
              $gender="Female";
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
            echo "<tr>
            <td>".$row4['pat_name']."</td>
            <td>".$gender."</td>
            <td>".$row4['pat_agey'].".".$row4['pat_agem']."</td>
            <td>".$row4['pat_phone']."</td>
            <td>".$fever."</td>
            <td>".$cough."</td>
            <td>".$breath."</td>
            <td>".$row4['sym_other']."</td>
            <td>".$row4['sym_days']."</td>
            <td>".date('D d-m-Y', $hosdate)."</td>
            <td>".$hyper."</td>
            <td>".$diab."</td>
            <td>".$cardi."</td>
            <td>".$respi."</td>
            <td>".$cancer."</td>
            <td>".$pregnent."</td>
            <td>".$immuno."</td>
            <td>".$row4['comorbid_other']."</td>
            <td>".$travelhistoryofpatient."</td><td>";
            ?>
            <?php
            if ($travhist==1) {
            if (mysqli_num_rows($result5) > 0)
            {
            while ($row5 = mysqli_fetch_assoc($result5)) {
                $timetrav=$row5['trav_date'];
                $timetravekfinal=date('D d-m-Y', $timetrav);
                echo $row5['trav_place']." - ".$timetravekfinal."<br>";
            }
          }else {
            echo "None";
          }}else {
            echo "---";
          }
             ?>
            <?php
            echo "</td>
            <td>".$travfamilyper."</td>
            <td>".$row4['no_travelper']."</td><td>";
            ?>
            <?php
            if ($travfamilyper1==1) {
            if (mysqli_num_rows($result6) > 0)
            {
            while ($row6 = mysqli_fetch_assoc($result6)) {
                $timetrav=$row6['travf_date'];
                $timetravekfinal=date('D d-m-Y', $timetrav);
                echo $row6['travf_place']." - ".$timetravekfinal."<br>";
            }
          }else {
            echo "None";
          }}else {
            echo "---";
          }

          ?>
         <?php
         echo "</td>
         <td>".$travlocal2."</td>
         <td>".$row4['house_cases']."</td><td>";
         ?>
         <?php
         if ($travlocal1==1) {
         if (mysqli_num_rows($result7) > 0)
         {
         while ($row7 = mysqli_fetch_assoc($result7)) {
              $nearpatgender=$row7['nearpat_age'];
              if ($nearpatgender==1) {
                $nearpatgender1="Male";
              }else {
                $nearpatgender1="Female";
              }
             echo $row7['nearpat_name']." - ".$row7['nearpat_age']." - ".$nearpatgender1."<br>";
         }
       }else {
         echo "None";
       }}else {
         echo "---";
       }
            echo "</td>
            <td>".$row4['pat_contact1']."  /  ".$row4['pat_contact2']."</td>
            </tr>";

          }
        }
           ?>
        </tbody>
        <tfoot>
            <tr>
                <th>Name</th>
                <th>Gender</th>
                <th>Age</th>
                <th>Phone No.</th>
                <th>Fever</th>
                <th>Cough</th>
                <th>Breathlessness</th>
                <th>Other Symptoms</th>
                <th>Symptoms (in Days)</th>
                <th>Hospitalization</th>
                <th>Hypertension</th>
                <th>Diabetes</th>
                <th>Cardiac Diseases</th>
                <th>Respiratory Diseases</th>
                <th>Cancer</th>
                <th>Pregnant</th>
                <th>ImmunoCompromised condition (HIV,Tb)</th>
                <th>Other Co-morbid conditions</th>
                <th>Any Travel History</th>
                <th>Traveled Places</th>
                <th>Family member traveled</th>
                <th>No. of Family member traveled</th>
                <th>Family member details</th>
                <th>Locality Member infected</th>
                <th>No. of Locality Member infected</th>
                <th>Locality member details</th>
                <th>Contact Details</th>
            </tr>
        </tfoot>
    </table><br><br>
  </div><br><br>
    <?php
      include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'footer.php';
     ?>

    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js"></script>
    <script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js" integrity="sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1" crossorigin="anonymous"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>
    <script src="https://code.jquery.com/jquery-3.3.1.js"></script>
    <script src="https://cdn.datatables.net/1.10.20/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/buttons/1.6.1/js/dataTables.buttons.min.js"></script>
    <script src="https://cdn.datatables.net/buttons/1.6.1/js/buttons.print.min.js"></script>
    <script src="https://cdn.datatables.net/buttons/1.6.1/js/buttons.colVis.min.js"></script>
    <script src="https://cdn.datatables.net/buttons/1.6.1/js/dataTables.buttons.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.1.3/jszip.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.53/pdfmake.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.53/vfs_fonts.js"></script>
    <script src="https://cdn.datatables.net/buttons/1.6.1/js/buttons.html5.min.js"></script>

          <script type="text/javascript">
          $(document).ready(function() {
      $('#example').DataTable( {
          dom: 'Bfrtip',
          buttons: [
            {
                extend: 'pdfHtml5',
                orientation: 'landscape',
                pageSize: 'LEGAL'
            },
              {
                  extend: 'print',
                  exportOptions: {
                      columns: ':visible'
                  }
              },
              'colvis'
          ],
          columnDefs: [ {
              targets: -1,
              visible: false
          } ]
      } );
    } );


          </script>


  </body>
</html>
