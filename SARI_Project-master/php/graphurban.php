<?php
include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'dbconn.php';

session_start();
if (isset($_SESSION['Did'])) {
  $id = $_SESSION['Did'];
} else {
  header("Location: ./login.php");
}


if (isset($_POST['graphurban'])) {
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

               $query4="SELECT travelhis,travelper,housenearby,sym_other,comorbid_other,pat_gender,fever,cough,breath,hypertension,diabetes,cardiac,respiratory,cancer,pregnant,immuno FROM patient WHERE district_id=$distid  &&  area_id=1 && timestamp BETWEEN $timeStamp AND $timeStamp2;";
               //echo $query4;
               $result4 = mysqli_query($con, $query4);
               if (mysqli_num_rows($result4) > 0)
               {
                 $feverahe=0;
                 $fevernahi=0;
                 $coughahe=0;
                 $coughnahi=0;
                 $breathahe=0;
                 $breathnahi=0;
                 $male=0;
                $female=0;
                $hypahe=0;
                $hypnahi=0;
                $diabahe=0;
                $diabnahi=0;
                $cardiahe=0;
                $cardinahi=0;
                $respahe=0;
                $respnahi=0;
                $canahe=0;
                $cannahi=0;
                $pregahe=0;
                $pregnahi=0;
                $immahe=0;
                $immnahi=0;
                $symahe=0;
                $symnahi=0;
                $comboahe=0;
                $combonahi=0;
                $travelkela=0;
                $travelnahi=0;
                $travelfkela=0;
                $travelfnahi=0;
                $houseahe=0;
                $housenahi=0;
               while ($row4 = mysqli_fetch_assoc($result4)) {


                 $travehis=$row4['travelhis'];
                 if ($travehis==1) {
                   $travelkela=$travelkela+1;
                 }
                 else {
                   $travelnahi=$travelnahi+1;
                 }


                 $travfamily=$row4['travelper'];
                 if ($travfamily==1) {
                   $travelfkela=$travelfkela+1;
                 }
                 else {
                   $travelfnahi=$travelfnahi+1;
                 }


                 $housenear=$row4['housenearby'];
                 if ($housenear==1) {
                   $houseahe=$houseahe+1;
                 }
                 else {
                   $housenahi=$housenahi+1;
                 }





                 $symtomdays=$row4['sym_other'];
                 if ($symtomdays=="NULL") {
                   $symnahi=$symnahi+1;
                 }
                 else {
                   $symahe=$symahe+1;
                 }

                 $othercombrid=$row4['comorbid_other'];
                 if ($othercombrid=="NULL") {
                   $combonahi=$combonahi+1;
                 }
                 else {
                   $comboahe=$comboahe+1;
                 }

                 $hypertension=$row4['hypertension'];
                 if ($hypertension==1) {
                   $hypahe=$hypahe+1;
                 }
                 else {
                   $hypnahi=$hypnahi+1;
                 }

                 $daib=$row4['diabetes'];
                 if ($daib==1) {
                   $diabahe=$diabahe+1;
                 }
                 else {
                   $diabnahi=$diabnahi+1;
                 }


                 $cadiac=$row4['cardiac'];
                 if ($cadiac==1) {
                   $cardiahe=$cardiahe+1;
                 }
                 else {
                   $cardinahi=$cardinahi+1;
                 }


                 $resp=$row4['respiratory'];
                 if ($resp==1) {
                   $respahe=$respahe+1;
                 }
                 else {
                   $respnahi=$respnahi+1;
                 }


                 $can=$row4['cancer'];
                 if ($can==1) {
                   $canahe=$canahe+1;
                 }
                 else {
                   $cannahi=$cannahi+1;
                 }

                 $preg=$row4['pregnant'];
                 if ($preg==1) {
                   $pregahe=$pregahe+1;
                 }
                 else {
                   $pregnahi=$pregnahi+1;
                 }

                 $imm=$row4['immuno'];
                 if ($imm==1) {
                   $immahe=$immnahi+1;
                 }
                 else {
                   $immnahi=$immnahi+1;
                 }



                 $gender=$row4['pat_gender'];
                 if ($gender==1) {
                   $male=$male+1;
                 }
                 else {
                   $female=$female+1;
                 }

                 $fever=$row4['fever'];
                 if ($fever==1) {
                   $feverahe=$feverahe+1;
                 }
                 else {
                   $fevernahi=$fevernahi+1;
                 }

                 $cough=$row4['cough'];
                 if ($cough==1) {
                   $coughahe=$coughahe+1;
                 }
                 else {
                   $coughnahi=$coughnahi+1;
                 }

                 $breath=$row4['breath'];
                 if ($breath==1) {
                   $breathahe=$breathahe+1;
                 }
                 else {
                   $breathnahi=$breathnahi+1;
                 }
               }
             }

}


 ?>
 
 <html lang="en" dir="ltr">
   <head>
     <meta charset="utf-8">
     <title></title>
     <link rel="stylesheet" href="../css/main.css">
       <meta content="width=device-width, initial-scale=1" name="viewport"/>
     <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">
     <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
     <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
      <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
   <link rel="icon" href="../images/bluelogo.jpg"></head>
   <body>
     <?php
       include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'header.php';
      ?><br><br><br>
       <div class="card dashcard1"style="padding:3%; background: rgb(255, 255, 255, 0.85);">
         <h1 style="text-align:center;">Analysis</h1><hr>
         <div class="mainbox"><div class="box box1 boxcolor">
           <table class="table table-hover">

             <?php
             $query4="SELECT * FROM blockurban WHERE district_id=$distid;";
             $result4 = mysqli_query($con, $query4);
             // $query4="SELECT travelhis,travelper,housenearby,sym_other,comorbid_other,pat_gender,fever,cough,breath,hypertension,diabetes,cardiac,respiratory,cancer,pregnant,immuno FROM patient WHERE district_id=$distid  &&  area_id=0 && timestamp BETWEEN $timeStamp AND $timeStamp2;";
             // $result4 = mysqli_query($con, $query4);

        if (mysqli_num_rows($result4) > 0)
        {   $i=1;
          while ($row4 = mysqli_fetch_assoc($result4)) {

            $blockid=$row4['bu_id'];
            $query2="SELECT pat_id FROM patient WHERE ublock_id=$blockid;";
            $result2 = mysqli_query($con, $query2);
          $row2= mysqli_num_rows($result2);
          ?>
           <tr>
             <th><?php echo $i; ?></th>
             <th scope="col"><?php echo $row4['bu_name']; ?></th>
             <th scope="col"><?php echo $row2; ?></th>
          </tr>
          <?php
          $i=$i+1;
        }} ?>


</table>
         </div></div>
              <div class="mainbox">
                <div class="box box1 boxcolor">
                  <script type="text/javascript">
                    google.charts.load("current", {packages:["corechart"]});
                    google.charts.setOnLoadCallback(drawChart);
                    function drawChart() {
                      var data = google.visualization.arrayToDataTable([
                        ['title', 'Ratio'],
                        ['Male',  parseInt('<?php echo $male; ?>')],
                        ['Female',   parseInt('<?php echo $female; ?>')]
                      ]);

                      var options = {
                        title: '',
                        is3D: true,
                      };

                      var chart = new google.visualization.PieChart(document.getElementById('Gender'));
                      chart.draw(data, options);
                    }
                  </script>
                  <h4>Gender</h4>
                  <div id="Gender" style="width:350px; height: 100;"></div>
                </div>
              </div><hr>
              <h4 style="text-align:center;">Symptoms</h4>
         <div class="mainbox">
           <div class="box box1 boxcolor">
               <script type="text/javascript">
                 google.charts.load("current", {packages:["corechart"]});
                 google.charts.setOnLoadCallback(drawChart);
                 function drawChart() {
                   var data = google.visualization.arrayToDataTable([
                     ['title', 'Ratio'],
                     ['Yes',  parseInt('<?php echo $feverahe; ?>')],
                     ['No',   parseInt('<?php echo $fevernahi; ?>')]
                   ]);

                   var options = {
                     title: '',
                     is3D: true,
                   };

                   var chart = new google.visualization.PieChart(document.getElementById('fever'));
                   chart.draw(data, options);
                 }
               </script>
               <h4>Fever</h4>
  <div id="fever" style="width:350px; height: 100;"></div>
           </div>
           <div class="box box1 boxcolor">
             <script type="text/javascript">
               google.charts.load("current", {packages:["corechart"]});
               google.charts.setOnLoadCallback(drawChart);
               function drawChart() {
                 var data = google.visualization.arrayToDataTable([
                   ['title', 'Ratio'],
                   ['Yes',  parseInt('<?php echo $coughahe; ?>')],
                   ['No',   parseInt('<?php echo $coughnahi; ?>')]
                 ]);

                 var options = {
                   title: '',
                   is3D: true,
                 };

                 var chart = new google.visualization.PieChart(document.getElementById('cough'));
                 chart.draw(data, options);
               }
             </script>
             <h4>Cough</h4>
<div id="cough" style="width:350px; height: 100;"></div>
           </div>

         </div>




         <div class="mainbox">
           <div class="box box1 boxcolor">
             <script type="text/javascript">
               google.charts.load("current", {packages:["corechart"]});
               google.charts.setOnLoadCallback(drawChart);
               function drawChart() {
                 var data = google.visualization.arrayToDataTable([
                   ['title', 'Ratio'],
                   ['Yes',  parseInt('<?php echo $breathahe; ?>')],
                   ['No',   parseInt('<?php echo $breathnahi; ?>')]
                 ]);

                 var options = {
                   title: '',
                   is3D: true,
                 };

                 var chart = new google.visualization.PieChart(document.getElementById('breath'));
                 chart.draw(data, options);
               }
             </script>
             <h4>Breathlessness</h4>
             <div id="breath" style="width:350px; height: 100;"></div>
           </div>
         <div class="box box1 boxcolor">
         <script type="text/javascript">
          google.charts.load("current", {packages:["corechart"]});
          google.charts.setOnLoadCallback(drawChart);
          function drawChart() {
            var data = google.visualization.arrayToDataTable([
              ['title', 'Ratio'],
              ['Yes',  parseInt('<?php echo $symahe; ?>')],
              ['No',   parseInt('<?php echo $symnahi; ?>')]
            ]);

            var options = {
              title: '',
              is3D: true,
            };

            var chart = new google.visualization.PieChart(document.getElementById('othersym'));
            chart.draw(data, options);
          }
         </script>
         <h4>Other Symptoms</h4>
         <div id="othersym" style="width:350px; height: 100;"></div>
         </div>
         </div>







         <hr>
         <h4 style="text-align:center;">Co-morbid conditions of SARI patient</h4>
         <div class="mainbox">
         <div class="box box1 boxcolor">
          <script type="text/javascript">
            google.charts.load("current", {packages:["corechart"]});
            google.charts.setOnLoadCallback(drawChart);
            function drawChart() {
              var data = google.visualization.arrayToDataTable([
                ['title', 'Ratio'],
                ['Yes',  parseInt('<?php echo $hypahe; ?>')],
                ['No',   parseInt('<?php echo $hypnahi; ?>')]
              ]);

              var options = {
                title: '',
                is3D: true,
              };

              var chart = new google.visualization.PieChart(document.getElementById('hypertension'));
              chart.draw(data, options);
            }
          </script>
          <h4>Hypertension</h4>
         <div id="hypertension" style="width:350px; height: 100;"></div>
         </div>
         <div class="box box1 boxcolor">
         <script type="text/javascript">
          google.charts.load("current", {packages:["corechart"]});
          google.charts.setOnLoadCallback(drawChart);
          function drawChart() {
            var data = google.visualization.arrayToDataTable([
              ['title', 'Ratio'],
              ['Yes',  parseInt('<?php echo $diabahe; ?>')],
              ['No',   parseInt('<?php echo $diabnahi; ?>')]
            ]);

            var options = {
              title: '',
              is3D: true,
            };

            var chart = new google.visualization.PieChart(document.getElementById('daibetes'));
            chart.draw(data, options);
          }
         </script>
         <h4>Diabetes</h4>
         <div id="daibetes" style="width:350px; height: 100;"></div>
         </div>
         <div class="box box1 boxcolor">
         <script type="text/javascript">
          google.charts.load("current", {packages:["corechart"]});
          google.charts.setOnLoadCallback(drawChart);
          function drawChart() {
            var data = google.visualization.arrayToDataTable([
              ['title', 'Ratio'],
              ['Yes',  parseInt('<?php echo $cardiahe; ?>')],
              ['No',   parseInt('<?php echo $cardinahi; ?>')]
            ]);

            var options = {
              title: '',
              is3D: true,
            };

            var chart = new google.visualization.PieChart(document.getElementById('cardiac'));
            chart.draw(data, options);
          }
         </script>
         <h4>Cardiac</h4>
         <div id="cardiac" style="width:350px; height: 100;"></div>
         </div>
         </div>




         <div class="mainbox">
         <div class="box box1 boxcolor">
          <script type="text/javascript">
            google.charts.load("current", {packages:["corechart"]});
            google.charts.setOnLoadCallback(drawChart);
            function drawChart() {
              var data = google.visualization.arrayToDataTable([
                ['title', 'Ratio'],
                ['Yes',  parseInt('<?php echo $respahe; ?>')],
                ['No',   parseInt('<?php echo $respnahi; ?>')]
              ]);

              var options = {
                title: '',
                is3D: true,
              };

              var chart = new google.visualization.PieChart(document.getElementById('respiratory'));
              chart.draw(data, options);
            }
          </script>
          <h4>Respiratory</h4>
         <div id="respiratory" style="width:350px; height: 100;"></div>
         </div>
         <div class="box box1 boxcolor">
         <script type="text/javascript">
          google.charts.load("current", {packages:["corechart"]});
          google.charts.setOnLoadCallback(drawChart);
          function drawChart() {
            var data = google.visualization.arrayToDataTable([
              ['title', 'Ratio'],
              ['Yes',  parseInt('<?php echo $canahe; ?>')],
              ['No',   parseInt('<?php echo $cannahi; ?>')]
            ]);

            var options = {
              title: '',
              is3D: true,
            };

            var chart = new google.visualization.PieChart(document.getElementById('cancer'));
            chart.draw(data, options);
          }
         </script>
         <h4>Cancer</h4>
         <div id="cancer" style="width:350px; height: 100;"></div>
         </div>
         <div class="box box1 boxcolor">
         <script type="text/javascript">
          google.charts.load("current", {packages:["corechart"]});
          google.charts.setOnLoadCallback(drawChart);
          function drawChart() {
            var data = google.visualization.arrayToDataTable([
              ['title', 'Ratio'],
              ['Yes',  parseInt('<?php echo $pregahe; ?>')],
              ['No',   parseInt('<?php echo $pregnahi; ?>')]
            ]);

            var options = {
              title: '',
              is3D: true,
            };

            var chart = new google.visualization.PieChart(document.getElementById('pregnant'));
            chart.draw(data, options);
          }
         </script>
         <h4>Pregnant</h4>
         <div id="pregnant" style="width:350px; height: 100;"></div>
         </div>
         </div>


         <div class="mainbox">
         <div class="box box1 boxcolor">
          <script type="text/javascript">
            google.charts.load("current", {packages:["corechart"]});
            google.charts.setOnLoadCallback(drawChart);
            function drawChart() {
              var data = google.visualization.arrayToDataTable([
                ['title', 'Ratio'],
                ['Yes',  parseInt('<?php echo $immahe; ?>')],
                ['No',   parseInt('<?php echo $immnahi; ?>')]
              ]);

              var options = {
                title: '',
                is3D: true,
              };

              var chart = new google.visualization.PieChart(document.getElementById('immuno'));
              chart.draw(data, options);
            }
          </script>
          <h4>ImmunoCompromised condition (HIV,Tb)</h4>
         <div id="immuno" style="width:350px; height: 100;"></div>
         </div>
         <div class="box box1 boxcolor">
         <script type="text/javascript">
          google.charts.load("current", {packages:["corechart"]});
          google.charts.setOnLoadCallback(drawChart);
          function drawChart() {
            var data = google.visualization.arrayToDataTable([
              ['title', 'Ratio'],
              ['Yes',  parseInt('<?php echo $comboahe; ?>')],
              ['No',   parseInt('<?php echo $combonahi; ?>')]
            ]);

            var options = {
              title: '',
              is3D: true,
            };

            var chart = new google.visualization.PieChart(document.getElementById('combrid'));
            chart.draw(data, options);
          }
         </script>
         <h4>Other Co-morbid conditions</h4>
         <div id="combrid" style="width:350px; height: 100;"></div>
         </div>
         </div>


         <hr>
         <h4 style="text-align:center;">Travel History</h4>
         <div class="mainbox">
         <div class="box box1 boxcolor">
          <script type="text/javascript">
            google.charts.load("current", {packages:["corechart"]});
            google.charts.setOnLoadCallback(drawChart);
            function drawChart() {
              var data = google.visualization.arrayToDataTable([
                ['title', 'Ratio'],
                ['Yes',  parseInt('<?php echo $travelkela; ?>')],
                ['No',   parseInt('<?php echo $travelnahi; ?>')]
              ]);
              var options = {
                title: '',
                is3D: true,
              };

              var chart = new google.visualization.PieChart(document.getElementById('trvelhis'));
              chart.draw(data, options);
            }
          </script>
          <h4>Any Travel History</h4>
         <div id="trvelhis" style="width:350px; height: 100;"></div>
         </div>
         <div class="box box1 boxcolor">
         <script type="text/javascript">
          google.charts.load("current", {packages:["corechart"]});
          google.charts.setOnLoadCallback(drawChart);
          function drawChart() {
            var data = google.visualization.arrayToDataTable([
              ['title', 'Ratio'],
              ['Yes',  parseInt('<?php echo $travelfkela; ?>')],
              ['No',   parseInt('<?php echo $travelfnahi; ?>')]
            ]);

            var options = {
              title: '',
              is3D: true,
            };

            var chart = new google.visualization.PieChart(document.getElementById('travf'));
            chart.draw(data, options);
          }
         </script>
         <h4>Any traveled person In Family</h4>
         <div id="travf" style="width:350px; height: 100;"></div>
         </div>
         <div class="box box1 boxcolor">
         <script type="text/javascript">
          google.charts.load("current", {packages:["corechart"]});
          google.charts.setOnLoadCallback(drawChart);
          function drawChart() {
            var data = google.visualization.arrayToDataTable([
              ['title', 'Ratio'],
              ['Yes',  parseInt('<?php echo $houseahe; ?>')],
              ['No',   parseInt('<?php echo $housenahi; ?>')]
            ]);

            var options = {
              title: '',
              is3D: true,
            };

            var chart = new google.visualization.PieChart(document.getElementById('house'));
            chart.draw(data, options);
          }
         </script>
         <h4>Is in that area nearby 50 houses having ILI/SARI cases</h4>
         <div id="house" style="width:350px; height: 100;"></div>
         </div>
         </div>




       </div>
       <br><br>
       <?php
         include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'footer.php';
        ?>
        <script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js" integrity="sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1" crossorigin="anonymous"></script>
        <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>
   </body>
 </html>
