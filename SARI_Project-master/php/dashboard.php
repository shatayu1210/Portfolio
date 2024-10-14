
<?php
include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'dbconn.php';

session_start();
if (isset($_SESSION['Did'])) {
  $id = $_SESSION['Did'];
} else {
  header("Location: ./login.php");
}

 ?>
<html lang="en" dir="ltr">
<head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1" name="viewport"/>
    <title>Dashboard</title>

    <link rel="stylesheet" href="../css/animate.css">
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.datatables.net/1.10.20/css/jquery.dataTables.min.css">
    <link rel="stylesheet" href="../css/main.css">
    <link rel="stylesheet" href="../css/footer.css">
    <style>
       /*Nav*/
nav {
      background-color: rgb(0, 161, 226, 0.85);
    }

    .navbar-brand {
      font-family: "Comic Sans MS", cursive, sans-serif;
      font-size: 18px;
      letter-spacing: 0px;
      word-spacing: 0px;
      color: #ffffff;
      font-weight: 400;
      text-decoration: none;
      font-style: normal;
      font-variant: small-caps;
      text-transform: none;
    }
    </style>
<link rel="icon" href="../images/bluelogo.jpg"></head>
<body>
     <!--Nav Bar-->
     <?php
       include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'header.php';
      ?>
  <!--Content-->
    <br><br><br>
    <div class="card dashcard animated zoomIn">
            <div class="tab" id="headlinks" role="tablist">
                <button class="tablinksfaculty tablinks headlink first active" id="v-pills-home-tab" data-toggle="pill" href="#v-pills-home" role="tab" aria-controls="v-pills-home" ><i class="fa fa-address-book" aria-hidden="true"></i><br><span>Timeline</span></button>
                <button class="tablinksfaculty tablinks headlink " id="v-pills-timeline-tab" data-toggle="pill" href="#v-pills-timeline" role="tab" aria-controls="v-pills-timeline" ><i class="fa fa-address-card" aria-hidden="true"></i><br><span>Individual Data</span></button>
                <button class="tablinksfaculty tablinks headlink " id="v-pills-graph-tab" data-toggle="pill" href="#v-pills-graph" role="tab" aria-controls="v-pills-graph"><i class="fa fa-pie-chart" aria-hidden="true"></i><br><span>Graph</span></button>
                <button class="tablinksfaculty tablinks headlink last" id="v-pills-tabular-tab" data-toggle="pill" href="#v-pills-tabular" role="tab" aria-controls="v-pills-tabular" ><i class="fa fa-table" aria-hidden="true"></i><br><span>Tabular</span></button>
            </div>
            <div class="tab-content" style="padding: 1% 3% 3% 3%" id="v-pills-tabContent">
                <div class="tab-pane" id="v-pills-home" role="tabpanel" aria-labelledby="v-pills-home-tab">
                  <!-- <h1>Timeline</h1> -->
                  <?php

                  $query1="SELECT pat_id FROM patient;";
                  $result1 = mysqli_query($con, $query1);
                  $row1= mysqli_num_rows($result1);

                  $query2="SELECT pat_id FROM patient WHERE area_id=1;";
                  $result2 = mysqli_query($con, $query2);
                  $row2= mysqli_num_rows($result2);

                  $query3="SELECT pat_id FROM patient WHERE area_id=0";
                  $result3 = mysqli_query($con, $query3);
                  $row3= mysqli_num_rows($result3);

                  $query4="SELECT pat_id FROM patient WHERE pat_gender=1";
                  $result4 = mysqli_query($con, $query4);
                  $row4= mysqli_num_rows($result4);

                  $query5="SELECT pat_id FROM patient WHERE pat_gender=0";
                  $result5 = mysqli_query($con, $query5);
                  $row5= mysqli_num_rows($result5);

                  $query6="SELECT pat_id FROM patient WHERE area_id=1 && pat_gender=1";
                  $result6 = mysqli_query($con, $query6);
                  $row6= mysqli_num_rows($result6);

                  $query7="SELECT pat_id FROM patient WHERE area_id=1 && pat_gender=0";
                  $result7 = mysqli_query($con, $query7);
                  $row7= mysqli_num_rows($result7);

                  $query8="SELECT pat_id FROM patient WHERE area_id=0 && pat_gender=1";
                  $result8 = mysqli_query($con, $query8);
                  $row8= mysqli_num_rows($result8);

                  $query9="SELECT pat_id FROM patient WHERE area_id=0 && pat_gender=0";
                  $result9 = mysqli_query($con, $query9);
                  $row9= mysqli_num_rows($result9);


                  $query10="SELECT pat_id FROM patient WHERE travelhis=1";
                  $result10 = mysqli_query($con, $query10);
                  $row10= mysqli_num_rows($result10);

                  $query11="SELECT pat_id FROM patient WHERE travelper=1";
                  $result11 = mysqli_query($con, $query11);
                  $row11= mysqli_num_rows($result11);

                  $query12="SELECT pat_id FROM patient WHERE housenearby=1";
                  $result12 = mysqli_query($con, $query12);
                  $row12= mysqli_num_rows($result12);

                  $query13="SELECT pat_id FROM patient WHERE area_id=0 && travelhis=1";
                  $result13 = mysqli_query($con, $query13);
                  $row13= mysqli_num_rows($result13);

                  $query14="SELECT pat_id FROM patient WHERE area_id=0 && travelper=1";
                  $result14 = mysqli_query($con, $query14);
                  $row14= mysqli_num_rows($result14);

                  $query15="SELECT pat_id FROM patient WHERE area_id=0 && housenearby=1";
                  $result15 = mysqli_query($con, $query15);
                  $row15= mysqli_num_rows($result15);

                  $query16="SELECT pat_id FROM patient WHERE area_id=1 && travelhis=1";
                  $result16 = mysqli_query($con, $query16);
                  $row16= mysqli_num_rows($result16);

                  $query17="SELECT pat_id FROM patient WHERE area_id=1 && travelper=1";
                  $result17 = mysqli_query($con, $query17);
                  $row17= mysqli_num_rows($result17);

                  $query18="SELECT pat_id FROM patient WHERE area_id=1 && housenearby=1";
                  $result18 = mysqli_query($con, $query18);
                  $row18= mysqli_num_rows($result18);
                   ?>
                   <div class="mainbox">
                     <div class="box boxcolor">
                       <table class="table table-hover" style="margin:auto;width:90%">
                       <thead>
                         <tr style="text-align:center;">
                           <th scope="col" colspan=2>Urban Analysis</th>
                         </tr>
                         <tr>
                           <th scope="col">Fields</th>
                           <th scope="col">Data</th>
                         </tr>
                       </thead>
                       <tbody>
                         <tr>
                           <th scope="row">No. of Patients Surveyed</th>
                           <td><?php  echo $row2; ?></td>
                         </tr>
                         <tr>
                         <tr>
                           <th scope="row">Male Cases</th>
                           <td><?php  echo $row6; ?></td>
                         </tr>
                         <tr>
                           <th scope="row">Female Cases</th>
                           <td><?php  echo $row7; ?></td>
                         </tr>
                         <tr>
                           <th scope="row">Travel History</th>
                           <td><?php  echo $row16; ?></td>
                         </tr>
                         <tr>
                           <th scope="row">Families Traveling History</th>
                           <td><?php  echo $row17; ?></td>
                         </tr>
                         <tr>
                           <th scope="row">Any patient in locality</th>
                           <td><?php  echo $row18; ?></td>
                         </tr>
                       </tbody>
                     </table>
                     </div>
                     <div class="box boxcolor">
                       <table class="table table-hover  table-dark" style="margin:auto;width:90%">
                       <thead>
                         <tr style="text-align:center;">
                           <th scope="col" colspan=2>Total Analysis</th>
                         </tr>
                         <tr>
                           <th scope="col">Fields</th>
                           <th scope="col">Data</th>
                         </tr>
                       </thead>
                       <tbody>
                         <tr>
                           <th scope="row">No. of Patients Surveyed</th>
                           <td><?php  echo $row1; ?></td>
                         </tr>
                         <tr>
                           <th scope="row">Male Cases</th>
                           <td><?php  echo $row4; ?></td>
                         </tr>
                         <tr>
                           <th scope="row">Female Cases</th>
                           <td><?php  echo $row5; ?></td>
                         </tr>
                         <tr>
                           <th scope="row">Travel History</th>
                           <td><?php  echo $row10; ?></td>
                         </tr>
                         <tr>
                           <th scope="row">Families Traveling History</th>
                           <td><?php  echo $row11; ?></td>
                         </tr>
                         <tr>
                           <th scope="row">Any patient in locality</th>
                           <td><?php  echo $row12; ?></td>
                         </tr>
                       </tbody>
                     </table>
                     </div>
                     <div class="box boxcolor">
                       <table class="table table-hover" style="margin:auto;width:90%">
                       <thead>
                         <tr style="text-align:center;">
                           <th scope="col" colspan=2>Rural Analysis</th>
                         </tr>
                         <tr>
                           <th scope="col">Fields</th>
                           <th scope="col">Data</th>
                         </tr>
                       </thead>
                       <tbody>
                         <tr>
                           <th scope="row">No. of Patients Surveyed</th>
                           <td><?php  echo $row3; ?></td>
                         </tr>
                         <tr>
                           <th scope="row">Male Cases</th>
                           <td><?php  echo $row8; ?></td>
                         </tr>
                         <tr>
                           <th scope="row">Female Cases</th>
                           <td><?php  echo $row9; ?></td>
                         </tr>
                         <tr>
                           <th scope="row">Travel History</th>
                           <td><?php  echo $row13; ?></td>
                         </tr>
                         <tr>
                           <th scope="row">Families Traveling History</th>
                           <td><?php  echo $row14; ?></td>
                         </tr>
                         <tr>
                           <th scope="row">Any patient in locality</th>
                           <td><?php  echo $row15; ?></td>
                         </tr>
                       </tbody>
                     </table>
                     </div>
                     <br><br>
                  </div>




                </div>
                <div class="tab-pane" id="v-pills-timeline" role="tabpanel" aria-labelledby="v-pills-timeline-tab">
            <h3 style="text-align:center;">View Data Individually</h3><br>
            <div class="card dashcard1"style="padding:3%;">
                  <table id="example" class="display" style="margin: 2%;width:100%;border:1px solid #000;" >
        <thead>
            <tr>
            <th>View</th>
                <th>Patient Name</th>
                <th>Gender</th>
                <th>Age</th>
                <th>Phone No</th>
            </tr>
        </thead>
        <tbody>
          <?php
          $query19 ="SELECT pat_id,pat_name,pat_gender,pat_agey,pat_agem,pat_phone FROM patient ORDER BY timestamp DESC";
          $result19 = mysqli_query($con, $query19);
          if (mysqli_num_rows($result19) > 0)
          {
          while ($row19 = mysqli_fetch_assoc($result19)) {
            $gen=$row19['pat_gender'];
            if ($gen==1) {
              $gender="Male";
            }else {
              $gender="Female";
            }
            echo "<tr>
            <td><a style='color:#0080b4;text-decoration:none;font-weight:500;' href='./viewdata.php?key=" . $row19['pat_id'] . '&uid='. 1 ."'>View</a></td>
            <td>".$row19['pat_name']."</td>
            <td>".$gender."</td>
            <td>".$row19['pat_agey'].".".$row19['pat_agem']."</td>
            <td>".$row19['pat_phone']."</td>
            </tr>";


          }
        }
          ?>
        </tbody>
      </table>
                </div>
              </div>
                <div class="tab-pane" id="v-pills-graph" role="tabpanel" aria-labelledby="v-pills-graph-tab">
                  <div class="mainbox">
                    <div class="box box1 boxcolor">
                      <h3>Urban Graph</h3>
                      <form class="" action="./graphurban.php" method="post"onsubmit="return val1()">
                          <div class="form-group">
                               <label for="dist">District:</label>
                           <select name='dist' id="dist" class="form-control">
                             <option disabled selected value>Select District</option>
                             <?php
                            $sql = "SELECT * FROM district";
                             $result = mysqli_query($con,$sql);
                             if (mysqli_num_rows($result) > 0)
                             {
                                 while ($row = mysqli_fetch_assoc($result))
                             {
                                 echo "<option value='".$row['district_id']."'>".$row['district_name']."</option>";
                             }
                           }
                              ?>
                           </select>
                           <span id="dist1" class="text-info" style="font-weight: 300"></span>
                          </div>
                           <div class="form-group">
                             <label for="sdate">Start Date</label>
                             <input type="date" name="date1" class="form-control" id="sdate" placeholder="Since when">
                               <span id="d1" class="text-info" style="font-weight: 300"></span>
                           </div>
                           <div class="form-group">
                             <label for="epdate">End Date</label>
                             <input type="date" name="date2" class="form-control" id="epdate" placeholder="Since when">
                               <span id="d2" class="text-info" style="font-weight: 300"></span>
                           </div>
                           <div class="text-center">
                              <input type="submit" name="graphurban" class="btn3"value="Show">
                           </div>


                      </form>
                      </div>

                     <script>
                       function val1() {
                       var district = document.getElementById('dist').value;
                       var udate1 = document.getElementById('sdate').value;
                       var udate2 = document.getElementById('epdate').value;

                        if(district == ""){
                                    document.getElementById('dist1').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(udate1 == ""){
                                    document.getElementById('d1').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(udate2 == ""){
                                    document.getElementById('d2').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(udate1>udate2){
                                    document.getElementById('d2').innerHTML ="Start Date cannot be greater";
                                    return false;

                                              }
                         }
                       </script>


                      <div class="box box1 boxcolor">
                      <h3>Total Graph</h3>
                      <form class="" action="./totalgraph.php" method="post"onsubmit="return val2()">
                          <div class="form-group">
                               <label for="dist2">District:</label>
                           <select name='dist' id="dist2" class="form-control">
                             <option disabled selected value>Select District</option>
                             <?php
                            $sql = "SELECT * FROM district";
                             $result = mysqli_query($con,$sql);
                             if (mysqli_num_rows($result) > 0)
                             {
                                 while ($row = mysqli_fetch_assoc($result))
                             {
                                 echo "<option value='".$row['district_id']."'>".$row['district_name']."</option>";
                             }
                           }
                              ?>
                           </select>
                          <span id="di2" class="text-info" style="font-weight: 300"></span>
                          </div>
                           <div class="form-group">
                             <label for="sdate1">Start Date</label>
                             <input type="date" name="date1" class="form-control" id="sdate1" placeholder="Since when">
                               <span id="da1" class="text-info" style="font-weight: 300"></span>
                           </div>
                           <div class="form-group">
                             <label for="epdate1">End Date</label>
                             <input type="date" name="date2" class="form-control" id="epdate1" placeholder="Since when">
                               <span id="da2" class="text-info" style="font-weight: 300"></span>
                           </div>
                           <div class="text-center">
                              <input type="submit" name="totalgraph" class="btn3"value="Show">
                           </div>
                      </form>
                    </div>
                      <script>
                       function val2() {
                       var dis = document.getElementById('dist2').value;
                       var tdate1 = document.getElementById('sdate1').value;
                       var tdate2 = document.getElementById('epdate1').value;

                        if(dis == ""){
                                    document.getElementById('di2').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(tdate1 == ""){
                                    document.getElementById('da1').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(tdate2 == ""){
                                    document.getElementById('da2').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(tdate1>tdate2){
                                    document.getElementById('da2').innerHTML ="Start Date cannot be greater";
                                    return false;

                                              }
                         }
                       </script>

                    <div class="box box1 boxcolor">
                      <h3>Rural Graph</h3>
                      <form class="" action="./graphrural.php" method="post" onsubmit="return val3()">
                          <div class="form-group">
                               <label for="dist3">District:</label>
                           <select name='dist' id="dist3" class="form-control">
                             <option disabled selected value>Select District</option>
                             <?php
                            $sql = "SELECT * FROM district";
                             $result = mysqli_query($con,$sql);
                             if (mysqli_num_rows($result) > 0)
                             {
                                 while ($row = mysqli_fetch_assoc($result))
                             {
                                 echo "<option value='".$row['district_id']."'>".$row['district_name']."</option>";
                             }
                           }
                              ?>
                           </select>
                          <span id="distr2" class="text-info" style="font-weight: 300"></span>
                          </div>
                           <div class="form-group">
                             <label for="sdate2">Start Date</label>
                             <input type="date" name="date1" class="form-control" id="sdate2" placeholder="Since when">
                               <span id="dat1" class="text-info" style="font-weight: 300"></span>
                           </div>
                           <div class="form-group">
                             <label for="epdate2">End Date</label>
                             <input type="date" name="date2" class="form-control" id="epdate2" placeholder="Since when">
                               <span id="dat2" class="text-info" style="font-weight: 300"></span>
                           </div>
                           <div class="text-center">
                              <input type="submit" name="graphrural" class="btn3"value="Show">
                           </div>


                      </form>
                    </div>
                  </div>
                </div>
                            <script>
                       function val3() {
                       var distr = document.getElementById('dist3').value;
                       var rdate1 = document.getElementById('sdate2').value;
                       var rdate2 = document.getElementById('epdate2').value;

                        if(distr == ""){
                                    document.getElementById('distr2').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(rdate1 == ""){
                                    document.getElementById('dat1').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(rdate2 == ""){
                                    document.getElementById('dat2').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(rdate1>rdate2){
                                    document.getElementById('dat2').innerHTML ="Start Date cannot be greater";
                                    return false;

                                              }
                         }
                       </script>
                <div class="tab-pane" id="v-pills-tabular" role="tabpanel" aria-labelledby="v-pills-tabular-tab">
                <div class="mainbox">
                  <div class="box box1 boxcolor">
                    <h3>PDF Urban</h3>
                    <form class="" action="./extracturban.php" method="post"onsubmit="return valid2()">
                        <div class="form-group">
                             <label for="distt1">District:</label>
                         <select name='dist' id="distt1" class="form-control">
                           <option disabled selected value>Select District</option>
                           <?php
                          $sql = "SELECT * FROM district";
                           $result = mysqli_query($con,$sql);
                           if (mysqli_num_rows($result) > 0)
                           {
                               while ($row = mysqli_fetch_assoc($result))
                           {
                               echo "<option value='".$row['district_id']."'>".$row['district_name']."</option>";
                           }
                         }
                            ?>
                         </select>
                          <span id="disp" class="text-info" style="font-weight: 300"></span>
                        </div>
                         <div class="form-group">
                           <label for="sdat">Start Date</label>
                           <input type="date" name="date1" class="form-control" id="sdat" placeholder="Since when">
                             <span id="y1" class="text-info" style="font-weight: 300"></span>

                         </div>
                         <div class="form-group">
                           <label for="epdat">End Date</label>
                           <input type="date" name="date2" class="form-control" id="epdat" placeholder="Since when">
                             <span id="y2" class="text-info" style="font-weight: 300"></span>

                         </div>
                         <div class="text-center">
                            <input type="submit" name="extractdata" class="btn3"value="Show">
                         </div>


                    </form>
                  </div>

                     <script>
                       function valid2() {
                       var distr33 = document.getElementById('distt1').value;
                       var pudate1 = document.getElementById('sdat').value;
                       var pudate2 = document.getElementById('epdat').value;

                        if(distr33 == ""){
                                    document.getElementById('disp').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(pudate1 == ""){
                                    document.getElementById('y1').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(pudate2 == ""){
                                    document.getElementById('y2').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(pudate1>pudate2){
                                    document.getElementById('y2').innerHTML ="Start Date cannot be greater";
                                    return false;

                                              }
                         }
                       </script>

                  <div class="box box1 boxcolor">
                    <h3>PDF Total</h3>
                    <form class="" action="./extracttotalpdf.php" method="post"onsubmit="return valid()">
                        <div class="form-group">
                             <label for="dist4">District:</label>
                         <select name='dist' id="dist4" class="form-control">
                           <option disabled selected value>Select District</option>
                           <?php
                          $sql = "SELECT * FROM district";
                           $result = mysqli_query($con,$sql);
                           if (mysqli_num_rows($result) > 0)
                           {
                               while ($row = mysqli_fetch_assoc($result))
                           {
                               echo "<option value='".$row['district_id']."'>".$row['district_name']."</option>";
                           }
                         }
                            ?>
                         </select>
                         <span id="distri" class="text-info" style="font-weight: 300"></span>
                        </div>
                         <div class="form-group">
                           <label for="sdate3">Start Date</label>
                           <input type="date" name="date1" class="form-control" id="sdate3" placeholder="Since when">
                             <span id="datee1" class="text-info" style="font-weight: 300"></span>
                         </div>
                         <div class="form-group">
                           <label for="epdate3">End Date</label>
                           <input type="date" name="date2" class="form-control" id="epdate3" placeholder="Since when">
                             <span id="datee2" class="text-info" style="font-weight: 300"></span>
                         </div>
                         <div class="text-center">
                            <input type="submit" name="extracttotalpdf" class="btn3"value="Show">
                         </div>


                    </form>
                  </div>
                     <script>
                       function valid() {
                       var distr11 = document.getElementById('dist4').value;
                       var ptdate1 = document.getElementById('sdate3').value;
                       var ptdate2 = document.getElementById('epdate3').value;

                        if(distr11 == ""){
                                    document.getElementById('distri').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(ptdate1 == ""){
                                    document.getElementById('datee1').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(ptdate2 == ""){
                                    document.getElementById('datee2').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(ptdate1>ptdate2){
                                    document.getElementById('datee2').innerHTML ="Start Date cannot be greater";
                                    return false;

                                              }
                         }
                       </script>
                       <div class="box box1 boxcolor">
                         <h3>PDF Rural</h3>
                         <form class="" action="./extractrural.php" method="post"onsubmit="return valid4()">
                             <div class="form-group">
                                  <label for="distt3">District:</label>
                              <select name='dist' id="distt3" class="form-control">
                                <option disabled selected value>Select District</option>
                                <?php
                               $sql = "SELECT * FROM district";
                                $result = mysqli_query($con,$sql);
                                if (mysqli_num_rows($result) > 0)
                                {
                                    while ($row = mysqli_fetch_assoc($result))
                                {
                                    echo "<option value='".$row['district_id']."'>".$row['district_name']."</option>";
                                }
                              }
                                 ?>
                              </select>
                             <span id="disp11" class="text-info" style="font-weight: 300"></span>
                             </div>
                              <div class="form-group">
                                <label for="sdates1">Start Date</label>
                                <input type="date" name="date1" class="form-control" id="sdates1" placeholder="Since when">
                                   <span id="disp22" class="text-info" style="font-weight: 300"></span>
                              </div>
                              <div class="form-group">
                                <label for="epdates1">End Date</label>
                                <input type="date" name="date2" class="form-control" id="epdates1" placeholder="Since when">
                             <span id="disp33" class="text-info" style="font-weight: 300"></span>
                             </div>
                              <div class="text-center">
                                 <input type="submit" name="extractruralpdf" class="btn3"value="Show">

                             </div>


                         </form>
                       </div>
                                  <script>
                            function valid4() {
                            var distr55 = document.getElementById('distt3').value;
                            var prdate1 = document.getElementById('sdates1').value;
                            var prdate2 = document.getElementById('epdates1').value;

                             if(distr55 == ""){
                                         document.getElementById('disp11').innerHTML ="Select one option";
                                         return false;

                                                   }
                                if(prdate1 == ""){
                                         document.getElementById('disp22').innerHTML ="Select one option";
                                         return false;

                                                   }
                                if(prdate2 == ""){
                                         document.getElementById('disp33').innerHTML ="Select one option";
                                         return false;

                                                   }
                                if(prdate1>prdate2){
                                         document.getElementById('disp33').innerHTML ="Start Date cannot be greater";
                                         return false;

                                                   }
                              }
                            </script>
                       </div>
                <div class="mainbox">

                    <div class="box box1 boxcolor">
                    <h3>Excel Urban</h3>
                    <form class="" action="./excelurban.php" method="post"onsubmit="return valid3()">
                        <div class="form-group">
                             <label for="distt2">District:</label>
                         <select name='dist' id="distt2" class="form-control">
                           <option disabled selected value>Select District</option>
                           <?php
                          $sql = "SELECT * FROM district";
                           $result = mysqli_query($con,$sql);
                           if (mysqli_num_rows($result) > 0)
                           {
                               while ($row = mysqli_fetch_assoc($result))
                           {
                               echo "<option value='".$row['district_id']."'>".$row['district_name']."</option>";
                           }
                         }
                            ?>
                         </select>
                          <span id="disp1" class="text-info" style="font-weight: 300"></span>
                        </div>
                         <div class="form-group">
                           <label for="sdates">Start Date</label>
                           <input type="date" name="date1" class="form-control" id="sdates" placeholder="Since when">
                              <span id="disp2" class="text-info" style="font-weight: 300"></span>
                         </div>
                         <div class="form-group">
                           <label for="epdates">End Date</label>
                           <input type="date" name="date2" class="form-control" id="epdates" placeholder="Since when">
                              <span id="disp3" class="text-info" style="font-weight: 300"></span>
                         </div>
                         <div class="text-center">
                            <input type="submit" name="excelurban" class="btn3"value="Show">
                         </div>


                    </form>
                  </div>

                    <script>
                       function valid3() {
                       var distr44 = document.getElementById('distt2').value;
                       var eudate1 = document.getElementById('sdates').value;
                       var eudate2 = document.getElementById('epdates').value;

                        if(distr44 == ""){
                                    document.getElementById('disp1').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(eudate1 == ""){
                                    document.getElementById('disp2').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(eudate2 == ""){
                                    document.getElementById('disp3').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(eudate1>eudate2){
                                    document.getElementById('disp3').innerHTML ="Start Date cannot be greater";
                                    return false;

                                              }
                         }
                       </script>

                                           <div class="box box1 boxcolor">
                                           <h3>Excel Total</h3>
                                           <form class="" action="./exceltotal.php" method="post"onsubmit="return valid1()">
                                               <div class="form-group">
                                                    <label for="dist5">District:</label>
                                                <select name='dist' id="dist5" class="form-control">
                                                  <option disabled selected value>Select District</option>
                                                  <?php
                                                 $sql = "SELECT * FROM district";
                                                  $result = mysqli_query($con,$sql);
                                                  if (mysqli_num_rows($result) > 0)
                                                  {
                                                      while ($row = mysqli_fetch_assoc($result))
                                                  {
                                                      echo "<option value='".$row['district_id']."'>".$row['district_name']."</option>";
                                                  }
                                                }
                                                   ?>
                                                </select>
                                                 <span id="districc" class="text-info" style="font-weight: 300"></span>
                                               </div>
                                                <div class="form-group">
                                                  <label for="sdate4">Start Date</label>
                                                  <input type="date" name="date1" class="form-control" id="sdate4" placeholder="Since when">
                                                     <span id="t1" class="text-info" style="font-weight: 300"></span>
                                                </div>
                                                <div class="form-group">
                                                  <label for="epdate4">End Date</label>
                                                  <input type="date" name="date2" class="form-control" id="epdate4" placeholder="Since when">
                                                     <span id="t2" class="text-info" style="font-weight: 300"></span>
                                                </div>
                                                <div class="text-center">
                                                   <input type="submit" name="exceltotal" class="btn3"value="Show">
                                                </div>


                                           </form>
                                         </div>

                                                   <script>
                                              function valid1() {
                                              var distr22 = document.getElementById('dist5').value;
                                              var etdate1 = document.getElementById('sdate4').value;
                                              var etdate2 = document.getElementById('epdate4').value;

                                               if(distr22 == ""){
                                                           document.getElementById('districc').innerHTML ="Select one option";
                                                           return false;

                                                                     }
                                                  if(etdate1 == ""){
                                                           document.getElementById('t1').innerHTML ="Select one option";
                                                           return false;

                                                                     }
                                                  if(etdate2 == ""){
                                                           document.getElementById('t2').innerHTML ="Select one option";
                                                           return false;

                                                                     }
                                                  if(etdate1>etdate2){
                                                           document.getElementById('t2').innerHTML ="Start Date cannot be greater";
                                                           return false;

                                                                     }
                                                }
                                              </script>

                  <div class="box box1 boxcolor">
                    <h3>Excel Rural</h3>
                    <form class="" action="./excelrural.php" method="post"onsubmit="return valid5()">
                        <div class="form-group">
                             <label for="distt4">District:</label>
                         <select name='dist' id="distt4" class="form-control">
                           <option disabled selected value>Select District</option>
                           <?php
                          $sql = "SELECT * FROM district";
                           $result = mysqli_query($con,$sql);
                           if (mysqli_num_rows($result) > 0)
                           {
                               while ($row = mysqli_fetch_assoc($result))
                           {
                               echo "<option value='".$row['district_id']."'>".$row['district_name']."</option>";
                           }
                         }
                            ?>
                         </select>
                         <span id="dispe" class="text-info" style="font-weight: 300"></span>
                        </div>
                         <div class="form-group">
                           <label for="sdates11">Start Date</label>
                           <input type="date" name="date1" class="form-control" id="sdates11" placeholder="Since when">
                              <span id="dispe1" class="text-info" style="font-weight: 300"></span>
                         </div>
                         <div class="form-group">
                           <label for="epdates11">End Date</label>
                           <input type="date" name="date2" class="form-control" id="epdates11" placeholder="Since when">
                              <span id="dispe2" class="text-info" style="font-weight: 300"></span>
                         </div>
                         <div class="text-center">
                            <input type="submit" name="excelrural" class="btn3"value="Show">
                         </div>


                    </form>
                  </div>

                </div>
              </div>

            </div>
        </div>
    <script>
                       function valid5() {
                       var distr66 = document.getElementById('distt4').value;
                       var erdate1 = document.getElementById('sdates11').value;
                       var erdate2 = document.getElementById('epdates11').value;

                        if(distr66 == ""){
                                    document.getElementById('dispe').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(erdate1 == ""){
                                    document.getElementById('dispe1').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(erdate2 == ""){
                                    document.getElementById('dispe2').innerHTML ="Select one option";
                                    return false;

                                              }
                           if(erdate1>erdate2){
                                    document.getElementById('dispe2').innerHTML ="Start Date cannot be greater";
                                    return false;

                                              }
                         }
                       </script>
        <br><br>  <br><br>
      <!--Footer-->
      <br><br>
      <?php
        include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'footer.php';
       ?>>
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js"></script>
    <script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js" integrity="sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1" crossorigin="anonymous"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>
    <script src="https://code.jquery.com/jquery-3.3.1.js"></script>
    <script src="https://cdn.datatables.net/1.10.20/js/jquery.dataTables.min.js"></script>

<script type="text/javascript">
$(document).ready(function() {
  $('#example').DataTable( {
      "columnDefs": [

      ]
  } );
} );
</script>

    <script>
        $(document).ready(function() {
            $('#v-pills-home').show();
            $('#v-pills-timeline').hide();
            $('#v-pills-graph').hide();
            $('#v-pills-tabular').hide();


            $("#v-pills-home-tab").click(function() {
                $("#v-pills-home").show();
                $('#v-pills-timeline').hide();
                $('#v-pills-graph').hide();
                $('#v-pills-tabular').hide();
            });

            $("#v-pills-timeline-tab").click(function() {
                $("#v-pills-timeline").show();
                $('#v-pills-home').hide();
                $('#v-pills-graph').hide();
                $('#v-pills-tabular').hide();
            });

            $("#v-pills-graph-tab").click(function() {
                $("#v-pills-graph").show();
                $('#v-pills-home').hide();
                $('#v-pills-timeline').hide();
                $('#v-pills-tabular').hide();
            });

            $("#v-pills-tabular-tab").click(function() {
                $("#v-pills-tabular").show();
                $('#v-pills-graph').hide();
                $('#v-pills-timeline').hide();
                $('#v-pills-home').hide();
            });

        });
    </script>
    <script>
        var header = document.getElementById("headlinks");
        var btns = header.getElementsByClassName("headlink");
        for (var i = 0; i < btns.length; i++) {
            btns[i].addEventListener("click", function() {
                var current = document.getElementsByClassName("active");
                current[0].className = current[0].className.replace(" active", "");
                this.className += " active";
            });
        }
    </script>
</body>
</html>
