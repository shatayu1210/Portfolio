<?php
session_start();
include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'dbconn.php';
// print_r($_SESSION); exit;

// if (isset($_SESSION['Aid'])) {
//   $id = $_SESSION['Aid'];
// } else {
//   header("Location: ./ashaworkerslogin.php?t=90909090");
// }
   $month = date('m');
   $day = date('d');
   $year = date('Y');

   //$today = $month . '/' . $day . '/' . $year;
   ?>
<html lang="en" dir="ltr">
   <head>
      <meta charset="utf-8">
      <title>Sari</title>
      <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css" integrity="sha384-Vkoo8x4CGsO3+Hhxv8T/Q5PaXtkKtu6ug5TOeNV6gBiFeWPGFN9MuhOf23Q9Ifjh" crossorigin="anonymous">
      <link rel="stylesheet" href="../css/animate.css">
      <link rel="stylesheet" href="../css/main.css">
      <link rel="stylesheet" href="../css/footer.css">
      <link rel="icon" href="../images/bluelogo.jpg">
      <style media="screen">
         .dashcard1{
         background-color: rgba(255, 255, 255, 0.8);
         margin: auto;
         width:60%;
         padding:50px;
         display: block;
         overflow-x: auto;
         border-radius: 15px 15px 15px 15px;
         -webkit-box-shadow: 0px 29px 124px -35px rgba(0, 0, 0, 0.75);
         -moz-box-shadow: 0px 29px 124px -35px rgba(0, 0, 0, 0.75);
         box-shadow: 0px 29px 124px -35px rgba(0, 0, 0, 0.75);
         }
         .btn2 { /*Circular Button*/
         padding: 8px;
         color: white;
         background: #00b6ff;
         border: #d3d3d3;
         display: inline-block;
         width: 100px;
         text-align: center;
         border-radius: 35px;
         }
         
         .noload{
            display:none;
         }
         .btn2:hover {
         background: #0080b4;
         color: white;
         }
         .btn3 {  /*Rectangular Button*/
         padding: 8px;
         color: white;
         background: #00b6ff;
         border: #d3d3d3;
         display: inline-block;
         width: 100px;
         text-align: center;
         border-radius: 5px;
         }
         .btn3:hover {
         background: #0080b4;
         color: white;
         }
         body {
         background-image: url("../images/backk.jpg");
         background-repeat: repeat-y;
         background-size: 100% auto;
         }
         @media (max-width: 890px) {
         .dashcard1 {
         width: 70%;
         }
         }
         @media (max-width: 830px) {
         .dashcard1 {
         width: 80%;
         }
         }
         @media (max-width: 695px) {
         .dashcard1 {
         width: 90%;
         }
         }
         @media (max-width: 612px) {
         .dashcard1 {
         width: 95%;
         }
         }
         /*Floating Button*/
         .button.sticky {
         text-align: center;
         height: 50px;
         width: 30%;
         z-index: 10;
         position: fixed;
         border-bottom-left-radius: 30px;
         border-bottom-right-radius: 30px;
         background-color: #00b6ff;
         border: none;
         text-align: center;
         padding: 5px;
         transition: all 0.5s;
         cursor: pointer;
         margin-top: 0;
         margin-left: 35%;
         font-weight: 400;
         font-size: 22px;
         }
         .button.sticky:hover {
         background: #0080b4
         }
         }
         @media (max-width: 550px)
         {
         .button.sticky {
         width:
         }
         }
      </style>

      <meta content="width=device-width, initial-scale=1" name="viewport"/>
   </head>
   <body >
     <?php
       include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'header.php';
      ?><br><br><br>

     
     
      <div  class="dashcard1 animated zoomIn"style="padding:10px 20px;">
      <h3 style="text-align:center; font-weight: 600;">SARI Survey</h3>
      <br>
      <form class=""  id="add_name" method="post" >
         <div class="row">
            <div class="col">
               <label for="dist">District:</label>
               <select name='dist' id="dist" class="form-control"required>
                  <option disabled selected value='0'>Select District</option>
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
               <span id="dist1" class="text-danger" style="font-weight: 700"></span><br>
            </div>
            <div class="col">
               <div id="rates">
                  <label for="rates">Area:</label><br>
                  <input type="radio" id="r1" name="rate" value="Urban" onChange="urbanSelected()"> Urban
                  <input type="radio" id="r2" name="rate" value="Rural" onChange="ruralSelected()"> Rural
               </div>
               <span id="rates1" class="text-danger" style="font-weight: 700"></span>
            </div>
         </div>
         <div class="row">
            <div class="col">
               <div id='rural_urban_layer' ></div>

            </div>
            <div class="col">
               <div id='mnpa99'></div>
            </div>
         </div>

         <div class="row">
            <div class="col">
               <div id='phclayer' ></div>
            </div>
            <div class="col">
               <div id='subcenter99'></div>
            </div>
         </div>
         <div class="row">
            <div class="col">
               <div id='village99'></div>
            </div>
            <div class="col">
            </div>
         </div>
         <div class="row">
           <span id="blockur0" class="text-danger" style="font-weight: 700;margin:auto;"></span>
         </div>
         <div class="row">
            <div class="col">
               <div class="form-group">
                  <label for="pname">Patients Name</label>
                  <input type="text" name="pname" class="form-control" value=""  id="pname" placeholder="Full Name">
                  <small>First Name  /   Middle Name   /  Last Name</small>
                  <span id="pname1" class="text-danger" style="font-weight: 700"></span>
               </div>
            </div>
         </div>
         <div class="row">
            <div class="form-group">
               <label for="pgender">Gender</label>
               <div class="radio"id="pgender">
                  <label><input type="radio" id="pgender1" value="1"name="optradiopgen"> Male</label>
               </div>
               <div class="radio">
                  <label><input type="radio" id="pgender2" value="2" name="optradiopgen"> Female</label>
               </div>
            </div>
         </div>
         <span id="pgender3" class="text-danger" style="font-weight: 700"></span>
         <div class="row">
            <div class="col">
               <div class="form-group">
                  <label for="age">Age</label>
                  <input type="number" name="pageyears" class="form-control" id="age" value="" placeholder="Year">
                  <small>Years</small>
                  <span id="age1" class="text-danger" style="font-weight: 700"></span>
               </div>
            </div>
            
              <div class="col">
               <div class="form-group">
                  <label for="month">Months</label>
                  <select id="month" name='pagemonths' class="form-control">
                     <option disabled selected value="13">Select Months</option>
                     <option value="0">0</option>
                     <option value="1">1</option>
                     <option value="2">2</option>
                     <option value="3">3</option>
                     <option value="4">4</option>
                     <option value="5">5</option>
                     <option value="6">6</option>
                     <option value="7">7</option>
                     <option value="8">8</option>
                     <option value="9">9</option>
                     <option value="10">10</option>
                     <option value="11">11</option>
                     <option value="12">12</option>
                  </select>
                  <small>Month</small>
                  <span id="month1" value='1' class="text-danger" style="font-weight: 700"></span>
               </div>
            </div>
         </div>
         <div class="row">
            <div class="col">
               <div class="form-group">
                  <label for="pnumber">Patients Phone Number</label>
                  <input type="text" value="" name="patnumber" class="form-control" id="pnumber" placeholder="Patient Phone number">
               </div>
            </div>
         </div>
         <span id="pnumber1" class="text-danger" style="font-weight: 700"></span>
         <div class="col">
            <div class="form-group">
               <label for="">Symptoms:</label>
               <div class="checkbox">
                  <label><input type="checkbox" name="fever" value="1"> Fever</label>
               </div>
               <div class="checkbox">
                  <label><input type="checkbox" name="cough" value="1"> Cough</label>
               </div>
               <div class="checkbox">
                  <label><input type="checkbox" name="breathlessness" value="1"> Breathlessness</label>
               </div>
               <div class="form-group">
                  <input type="text" class="form-control" name="othersymptoms" value="" placeholder="Enter if any other Symptoms">
               </div>
            </div>
         </div>
         <div class="row">
            <div class="col">
               <div class="form-group">
                  <label for="sympdays">Onset of Symptoms (In Days)</label>
                  <input type="number" name="sympdays" class="form-control" id="sympdays" placeholder="Since when" value="">
                  <span id="sympdays1" class="text-danger" style="font-weight: 700"></span>
               </div>
            </div>
            <div class="col">
               <div class="form-group">
                  <label for="hpdate">Date of Hospitalization</label>
                  <input type="date" name="hpdate" class="form-control" id="hpdate" value="<?php echo $today; ?>" placeholder="Since when">
                  <span id="hpdate1" class="text-danger" style="font-weight: 700"></span>
               </div>
            </div>
         </div>
         <div class="col">
            <div class="form-group">
               <label for="pnumber">Co-morbid conditions of SARI patient:</label>
               <div class="checkbox">
                  <label><input type="checkbox" name="Hypertension" value="1"> Hypertension</label>
               </div>
               <div class="checkbox">
                  <label><input type="checkbox" name="Diabetes" value="1"> Diabetes</label>
               </div>
               <div class="checkbox">
                  <label><input type="checkbox" name="Cardiac" value="1"> Cardiac Diseases</label>
               </div>
               <div class="checkbox">
                  <label><input type="checkbox" name="Respiratory" value="1"> Respiratory Diseases</label>
               </div>
               <div class="checkbox">
                  <label><input type="checkbox" name="Cancer" value="1"> Cancer</label>
               </div>
               <div class="checkbox">
                  <label><input type="checkbox" name="Pregnant" value="1"> Pregnant</label>
               </div>
               <div class="checkbox">
                  <label><input type="checkbox" name="otherimmuno" value="1"> ImmunoCompromised condition (HIV,Tb)</label>
               </div>
               <input type="text" class="form-control" name="otherconditionscomorbid" value="" placeholder="Enter if any other Co-morbid conditions">
            </div>
         </div>
         <br>
         <div class="row">
            <div class="col">
               <div class="form-group">
                  <label for="travelhis">Any Travel History</label>
                  <select id="travelhis" name='travelhis' class="form-control">
                     <option disabled selected value>Select option</option>
                     <option value="1">Yes</option>
                     <option value="0">No</option>
                  </select>
                  <span id="travelhis1" class="text-danger" style="font-weight: 700"></span>
               </div>
            </div>
         </div>
         <div class="row">
            <div class="col">
               <div class="form-group" id="otherfieldiv">
                  <label for="dynamic_field">Enter Place & Date:</label>
                  <table class="table table-bordered table-responsive" id="dynamic_field">
                     <tr>
                        <td><input type="text" style="width:205px;" name="place[]"id="otherfield1" placeholder="Enter Place" class="form-control name_list"  /></td>
                        <td><input type="date" name="date1[]"id="otherfield2" placeholder="Enter Date" class="form-control name_list"  /></td>
                        <td><button type="button" name="add" id="add" class="btn btn3">Add More</button></td>
                     </tr>
                  </table>
               </div>
            </div>
         </div>
         <div class="row">
            <div class="col">
               <div class="form-group">
                  <label for="travelper">Any Travelled Person in Family</label>
                  <select id="travelper" name='travelper' class="form-control">
                     <option disabled selected value>Select option</option>
                     <option value="1">Yes</option>
                     <option value="0">No</option>
                  </select>
                  <span id="travelper1" class="text-danger" style="font-weight: 700"></span>
               </div>
            </div>
         </div>
         <div class="row">
            <div class="col">
               <div class="form-group"id="tperson">
                  <label for="tperson">If Yes, how many person</label>
                  <input type="number" name="nopatientstravel" class="form-control"/>
               </div>
            </div>
            <div class="col"></div>
         </div>
         <div class="col">
            <div class="form-group" id="otherfieldiv2">
               <label for="dynamic_field2">Mention Place and date:</label>
               <table class="table table-bordered table-responsive" id="dynamic_field2">
                  <tr>
                     <td><input type="text" style="width:205px"name="place2[]"id="otherfield21" placeholder="Enter Place" class="form-control name_list"/></td>
                     <td><input type="date" name="date2[]"id="otherfield22" placeholder="Enter Date" class="form-control name_list"/></td>
                     <td><button type="button" name="add2" id="add2" class="btn btn3">Add More</button></td>
                  </tr>
               </table>
            </div>
         </div>
         <div class="row">
            <div class="col">
               <div class="form-group">
                  <label for="near">Is in that area nearby 50 houses having ILI/SARI cases</label>
                  <select id="near" name='nearby' class="form-control">
                     <option disabled selected value>Select option</option>
                     <option value="1">Yes</option>
                     <option value="0">No</option>
                  </select>
                  <span id="near1" class="text-danger" style="font-weight: 700"></span>
               </div>
            </div>
         </div>
         <div class="row">
            <div class="col">
               <div class="form-group"id="nopatients">
                  <label for="nopatients">If Yes,How Many cases</label>
                  <input type="number" class="form-control" name="nopatients1"/>
               </div>
            </div>
            <div class="col"></div>
         </div>
         <div class="row">
            <div class="col">
               <div class="form-group" id="otherfieldiv1">
                  <label for="dynamic_field1">Contacts list of SARI admitted patient - Enter all Name , Age, Sex in separate row</label>
                  <table class="table table-bordered table-responsive" id="dynamic_field1">
                     <tr>
                        <td><input type="text" style="width:205px;"name="name3[]"id="otherfield11" placeholder="Enter Name" class="form-control name_list"/></td>
                        <td><input type="number" style="width:205px;"name="age3[]"id="otherfield12" placeholder="Enter Age" class="form-control name_list"/></td>
                        <td>
                           <select id="otherfield13" style="width:105px;" name='sex3[]' class="form-control">
                              <option disabled selected value>Sex</option>
                              <option value="1"> Male</option>
                              <option value="0">Female</option>
                           </select>
                        </td>
                        <td><button type="button" name="add1" id="add1" class="btn btn3">Add More</button></td>
                     </tr>
                  </table>
               </div>
            </div>
         </div>
         <label for="pnumber">Mention Contact Number:</label>
         <div class="row">
            <div class="col">
               <div class="form-group">
                  <label for="pnumber12">Contact Number 1</label>
                  <input type="text" name="pccontact1" class="form-control" id="pnumber12" placeholder="Contact No. 1" >
                  <span id="pnumber121" class="text-danger" style="font-weight: 700"></span>
               </div>
            </div>
            <div class="col">
               <div class="form-group">
                  <label for="pnumber13">Contact Number 2</label>
                  <input type="text" name="pccontact2" class="form-control" id="pnumber13" placeholder="Contact No. 2">
                  <span id="pnumber122" class="text-danger" style="font-weight: 700"></span>
               </div>
            </div>
         </div>
         <input type="button" style="width:210px;" class="btn btn3" onclick="getLocation()"value="Get Location"/><br><small>Allow Location Access On Your Device</small><br><small>For each entry get new location.</small>
         <p id="demo" ></p>
         <input type="hidden" id="lat" name="lat" />
         <input type="hidden" id="long" name="long" />
         <span id="getloc" class="text-danger" style="font-weight: 700"></span>
         <div id="hello" class="text-center noload" style="
         color: #00b6ff;
    margin:auto;    
    padding:auto;
    max-width: 100%;
    z-index: 99999;">
                      <h5>Loading Please Wait .....</h4>
  </div>
  <br><br>

         <div class="text-center">
            <!-- <input type="button" id="submit"  name="surveycompleted" value="Submit"> -->
            <input type="button" id="submit"  name="surveycompleted" class="btn btn2" value="Submit">
         </div>
      </form>
     
    </div>
      <br><br>
      <?php
        include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'footer.php';
       ?>
      <script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js" integrity="sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1" crossorigin="anonymous"></script>
      <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>
      <script>
         var x = document.getElementById("demo");

         function getLocation() {
           if (navigator.geolocation) {
             navigator.geolocation.getCurrentPosition(showPosition);
                document.getElementById('getloc').innerHTML ="";
           } else {
             x.innerHTML = "Geolocation is not supported by this browser.";
                document.getElementById('getloc').innerHTML ="";
           }
         }

         function showPosition(position) {
           x.innerHTML = "Latitude: " + position.coords.latitude +
           "<br>Longitude: " + position.coords.longitude;
           document.getElementById("lat").value =position.coords.latitude ;
             document.getElementById("long").value =position.coords.longitude ;
                document.getElementById('getloc').innerHTML ="";
         }
      </script>

      <script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js" integrity="sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1" crossorigin="anonymous"></script>
      <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>
      <!--<script type="text/javascript" src="/js/jquery-1.2.6.min.js"></script>
         <script  type="text/javascript" src="/js/jquery-ui-personalized-1.5.2.packed.js"></script>
         <script type="text/javascript" src="/js/sprinkle.js"></script>  -->
      <!-- <script src="//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js"></script> -->
      <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js"></script>
      <script type="text/javascript">
         //------------------------URBAN--------------------------------------------
 var blockur1check;
             //URBAN-Block
             function urbanSelected(){
               blockur1check=0;
               $("#mnpa99").show();
               $("#phclayer").hide();
               $("#subcenter99").hide();
               $("#village99").hide();
               // var link = document.getElementById('phclayer');
               // link.style.display = 'none';
               var e = document.getElementById("dist");
             var u_id = e.options[e.selectedIndex].value;
               // console.log($d_id);
              $.ajax({
                  url : "blockurban.php?u_id="+u_id,
                  cache : false,
                  complete : function($response, $status){
                     // console.log($response.responseText);
                      if ($status != "error" && $status != "timeout") {
                          $('#rural_urban_layer').html($response.responseText);
                      }
                  },
                  error : function ($responseObj){
                      alert("Something went wrong while processing your request.\n\nError => "
                          + $responseObj.responseText);
                  }
              });
             }


             //MUNICIPAL CORPORATION
             function get_mnpa($mnpa_id){
              $.ajax({
                  url : "mnpa.php?m_id="+$mnpa_id,
                  cache : false,
                  complete : function($response, $status){
                     // console.log($response.responseText);
                      if ($status != "error" && $status != "timeout") {
                          $('#mnpa99').html($response.responseText);
                      }
                  },
                  error : function ($responseObj){
                      alert("Something went wrong while processing your request.\n\nError => "
                          + $responseObj.responseText);
                  }
              });
             }

         //------------------------RURAL----------------------------

         //RURAL-Block
         function ruralSelected(){
          blockur1check=1;
           $("#mnpa99").hide();
           $("#phclayer").show();
               $("#subcenter99").show();
               $("#village99").show();
               var e = document.getElementById("dist");
             var d_id = e.options[e.selectedIndex].value;
               // console.log($d_id);
              $.ajax({
                  url : "block.php?d_id="+d_id,
                  cache : false,
                  complete : function($response, $status){
                     // console.log($response.responseText);
                      if ($status != "error" && $status != "timeout") {
                          $('#rural_urban_layer').html($response.responseText);
                      }
                  },
                  error : function ($responseObj){
                      alert("Something went wrong while processing your request.\n\nError => "
                          + $responseObj.responseText);
                  }
              });
             }
         //PHC
         function get_phc($b_id){


              $.ajax({
                  url : "phc.php?b_id="+$b_id,
                  cache : false,
                  complete : function($response, $status){
                   //  console.log($response.responseText);
                      if ($status != "error" && $status != "timeout") {
                          $('#phclayer').html($response.responseText);
                      }
                  },
                  error : function ($responseObj){
                      alert("Something went wrong while processing your request.\n\nError => "
                          + $responseObj.responseText);
                  }
              });
             }

         //Subcenter
             function get_subcenter($phc_id){
              $.ajax({
                  url : "subcenter.php?phc_id="+$phc_id,
                  cache : false,
                  complete : function($response, $status){
                      if ($status != "error" && $status != "timeout") {
                          $('#subcenter99').html($response.responseText);
                      }
                  },
                  error : function ($responseObj){
                      alert("Something went wrong while processing your request.\n\nError => "
                          + $responseObj.responseText);
                  }
              });


             }

         //Village
             function get_village($v_id){
              $.ajax({
                  url : "village.php?v_id="+$v_id,
                  cache : false,
                  complete : function($response, $status){
                      if ($status != "error" && $status != "timeout") {
                          $('#village99').html($response.responseText);
                      }
                  },
                  error : function ($responseObj){
                      alert("Something went wrong while processing your request.\n\nError => "
                          + $responseObj.responseText);
                  }
              });
             }

      </script>
      <script type="text/javascript">
         $(document).ready(function(){
          

           $('#submit').click(function(){

                 var district = document.getElementById('dist').value;
                 // console.log(district);
                 // var area = document.getElementById('rates').value;
                  var r1 = document.getElementById('r1');
                  var r2 = document.getElementById('r2');
                  var lat = document.getElementById('lat').value;
                  var long = document.getElementById('long').value;

                  var n =  document.getElementById('pname').value;
                  var gender1 = document.getElementById('pgender1');
                   var gender2 = document.getElementById('pgender2');
                  var age = document.getElementById('age').value;
                  var pmonth = document.getElementById('month').value;
                  var phone = document.getElementById('pnumber').value;
                  var onset = document.getElementById('sympdays').value;
                  var hos = document.getElementById('pnumber').value;
                  var dat = document.getElementById('hpdate').value;
                  var trav = document.getElementById('travelhis').value;
                  var travf = document.getElementById('travelper').value;
                  var nearby = document.getElementById('near').value;
                  var contact = document.getElementById('pnumber12').value;
                   var contact2 = document.getElementById('pnumber13').value;
                   if (r1.checked || r2.checked) {
                     var block = document.getElementById('block').value;
                     // console.log("block "+ block);
                    }

                    var mnpaval,mnpa = document.getElementById('mnpa');
                          if (mnpa != null) {
                               mnpaval = mnpa.value;
                              // console.log("mnpa" + mnpaval);
                          }
                          else {
                            mnpaval = null;
                              // console.log("mnpa" + mnpaval);
                          }


                                              var phcval,phc1 = document.getElementById('phc');
                                                    if (phc1 != null) {
                                                         phcval = phc1.value;
                                                        // console.log("phc" + phcval);
                                                    }
                                                    else {
                                                      phcval = null;
                                                        // console.log("mnpa" + phcval);
                                                    }

                                                    //subcenter
                                                    var subval,sub1 = document.getElementById('subcenter');
                                                          if (sub1 != null) {
                                                               subval = sub1.value;
                                                              // console.log("subcenter" + subval);
                                                          }
                                                          else {
                                                            subval = null;
                                                              // console.log("subcenter" + subval);
                                                          }


                                                          //Village
                                                          var villageval,village1 = document.getElementById('village');
                                                                if (village1 != null) {
                                                                     villageval = village1.value;
                                                                     // console.log("village" + villageval);
                                                                }

                                                                else {
                                                                  villageval = null;
                                                                    // console.log("village" + villageval);
                                                                }



                  var regex_name = /^[a-zA-Z \s]*$/;
                   var regex_phone = /^[\s()+-]*([0-9][\s()+-]*){10}$/;
                  // console.log(ub1);


                 if(district==0){
                     // console.log("dist");
                  document.getElementById("dist1").focus();
                   document.getElementById('dist1').innerHTML ="Select a district";
                   document.getElementById('blockur1').innerHTML ="";
                   document.getElementById('pname1').innerHTML ="";
                   document.getElementById('pgender3').innerHTML ="";
                   document.getElementById('age1').innerHTML ="";
                   document.getElementById('month1').innerHTML ="";
                   document.getElementById('pnumber1').innerHTML ="";
                   document.getElementById('sympdays1').innerHTML ="";
                   document.getElementById('hpdate1').innerHTML ="";
                   document.getElementById('travelhis1').innerHTML =""
                    document.getElementById('travelper1').innerHTML ="";
                     document.getElementById('near1').innerHTML ="";
                       document.getElementById('pnumber121').innerHTML ="";
                       document.getElementById('pnumber122').innerHTML ="";
                        document.getElementById('rates1').innerHTML ="";
                           document.getElementById('getloc').innerHTML ="";
                        // document.getElementById('rural_urban_layer1').innerHTML ="";
                   // document.getElementById('mnpa1').innerHTML ="";


                  }

                   else if(!r1.checked && !r2.checked){
                   document.getElementById('rates1').innerHTML ="Select an area";
                    document.getElementById('dist1').innerHTML ="";
                    document.getElementById('blockur0').innerHTML ="";
                   document.getElementById('pname1').innerHTML ="";
                   document.getElementById('pgender3').innerHTML ="";
                   document.getElementById('age1').innerHTML ="";
                   document.getElementById('month1').innerHTML ="";
                   document.getElementById('pnumber1').innerHTML ="";
                   document.getElementById('sympdays1').innerHTML ="";
                   document.getElementById('hpdate1').innerHTML ="";
                   document.getElementById('travelhis1').innerHTML =""
                    document.getElementById('travelper1').innerHTML ="";
                     document.getElementById('near1').innerHTML ="";
                       document.getElementById('pnumber121').innerHTML ="";
                       document.getElementById('pnumber122').innerHTML ="";
                       // document.getElementById('rural_urban_layer1').innerHTML ="";
                   // document.getElementById('mnpa1').innerHTML ="";
                    document.getElementById('getloc').innerHTML ="";
                  }

                  else if(blockur1check==0){

                    // console.log(blockur1check);
                    //
                    // console.log('Urban');
                     if(block==0){

                   document.getElementById('blockur0').innerHTML ="Select Block.";

                   document.getElementById('pname1').innerHTML ="";
                   document.getElementById('pgender3').innerHTML ="";
                   document.getElementById('age1').innerHTML ="";
                   document.getElementById('month1').innerHTML ="";
                   document.getElementById('pnumber1').innerHTML ="";
                   document.getElementById('sympdays1').innerHTML ="";
                   document.getElementById('hpdate1').innerHTML ="";
                   document.getElementById('travelhis1').innerHTML =""
                    document.getElementById('travelper1').innerHTML ="";
                     document.getElementById('near1').innerHTML ="";
                       document.getElementById('pnumber121').innerHTML ="";
                       document.getElementById('pnumber122').innerHTML ="";
                        document.getElementById('rates1').innerHTML ="";
                           document.getElementById('getloc').innerHTML ="";
                        // document.getElementById('rural_urban_layer1').innerHTML ="";
                   // document.getElementById('mnpa1').innerHTML ="";

                     }
                                                else if(mnpaval == 0){


                           document.getElementById('blockur0').innerHTML ="Select  Municipal Corporation.";

                           document.getElementById('pname1').innerHTML ="";
                           document.getElementById('pgender3').innerHTML ="";
                           document.getElementById('age1').innerHTML ="";
                           document.getElementById('month1').innerHTML ="";
                           document.getElementById('pnumber1').innerHTML ="";
                           document.getElementById('sympdays1').innerHTML ="";
                           document.getElementById('hpdate1').innerHTML ="";
                           document.getElementById('travelhis1').innerHTML =""
                           document.getElementById('travelper1').innerHTML ="";
                           document.getElementById('near1').innerHTML ="";
                              document.getElementById('pnumber121').innerHTML ="";
                              document.getElementById('pnumber122').innerHTML ="";
                              document.getElementById('rates1').innerHTML ="";
                                 document.getElementById('getloc').innerHTML ="";
                           // document.getElementById('mnpa1').innerHTML ="";


                           }
                           
                  else{
                     // console.log('break');
                     breakme();
                  }


                  }


                   else if(blockur1check==1){

                    if(block==0){



                          document.getElementById('blockur0').innerHTML ="Select Block";

                          document.getElementById('pname1').innerHTML ="";
                          document.getElementById('pgender3').innerHTML ="";
                          document.getElementById('age1').innerHTML ="";
                          document.getElementById('month1').innerHTML ="";
                          document.getElementById('pnumber1').innerHTML ="";
                          document.getElementById('sympdays1').innerHTML ="";
                          document.getElementById('hpdate1').innerHTML ="";
                          document.getElementById('travelhis1').innerHTML =""
                          document.getElementById('travelper1').innerHTML ="";
                           document.getElementById('near1').innerHTML ="";
                             document.getElementById('pnumber121').innerHTML ="";
                             document.getElementById('pnumber122').innerHTML ="";
                              document.getElementById('rates1').innerHTML ="";
                                 document.getElementById('getloc').innerHTML ="";
                          // document.getElementById('mnpa1').innerHTML ="";


                          }
                          else if(phcval==0){



                                document.getElementById('blockur0').innerHTML ="Select  PHC .";

                                document.getElementById('pname1').innerHTML ="";
                                document.getElementById('pgender3').innerHTML ="";
                                document.getElementById('age1').innerHTML ="";
                                document.getElementById('month1').innerHTML ="";
                                document.getElementById('pnumber1').innerHTML ="";
                                document.getElementById('sympdays1').innerHTML ="";
                                document.getElementById('hpdate1').innerHTML ="";
                                document.getElementById('travelhis1').innerHTML =""
                                document.getElementById('travelper1').innerHTML ="";
                                 document.getElementById('near1').innerHTML ="";
                                   document.getElementById('pnumber121').innerHTML ="";
                                   document.getElementById('pnumber122').innerHTML ="";
                                    document.getElementById('rates1').innerHTML ="";
                                       document.getElementById('getloc').innerHTML ="";
                                // document.getElementById('mnpa1').innerHTML ="";


                                }
                                else if(subval==0){



                                      document.getElementById('blockur0').innerHTML ="Select  Subcenter .";

                                      document.getElementById('pname1').innerHTML ="";
                                      document.getElementById('pgender3').innerHTML ="";
                                      document.getElementById('age1').innerHTML ="";
                                      document.getElementById('month1').innerHTML ="";
                                      document.getElementById('pnumber1').innerHTML ="";
                                      document.getElementById('sympdays1').innerHTML ="";
                                      document.getElementById('hpdate1').innerHTML ="";
                                      document.getElementById('travelhis1').innerHTML =""
                                      document.getElementById('travelper1').innerHTML ="";
                                       document.getElementById('near1').innerHTML ="";
                                         document.getElementById('pnumber121').innerHTML ="";
                                         document.getElementById('pnumber122').innerHTML ="";
                                          document.getElementById('rates1').innerHTML ="";
                                             document.getElementById('getloc').innerHTML ="";
                                      // document.getElementById('mnpa1').innerHTML ="";


                                      }
                                      else if(villageval==0){



                                            document.getElementById('blockur0').innerHTML ="Select  Village .";

                                            document.getElementById('pname1').innerHTML ="";
                                            document.getElementById('pgender3').innerHTML ="";
                                            document.getElementById('age1').innerHTML ="";
                                            document.getElementById('month1').innerHTML ="";
                                            document.getElementById('pnumber1').innerHTML ="";
                                            document.getElementById('sympdays1').innerHTML ="";
                                            document.getElementById('hpdate1').innerHTML ="";
                                            document.getElementById('travelhis1').innerHTML =""
                                            document.getElementById('travelper1').innerHTML ="";
                                             document.getElementById('near1').innerHTML ="";
                                               document.getElementById('pnumber121').innerHTML ="";
                                               document.getElementById('pnumber122').innerHTML ="";
                                                document.getElementById('rates1').innerHTML ="";
                                                   document.getElementById('getloc').innerHTML ="";
                                            // document.getElementById('mnpa1').innerHTML ="";


                                            }

                          else{
                           // console.log('break');
                           breakme();
                          }
                   }





                  function breakme(){
                     if(n.trim()==""){
                       // console.log("name");
                     document.getElementById('rates1').innerHTML ="";
                     document.getElementById('blockur0').innerHTML ="";
                      document.getElementById('dist1').innerHTML ="";
                     document.getElementById('pname1').innerHTML ="<br>Please fill a name";
                     document.getElementById('pgender3').innerHTML ="";
                     document.getElementById('age1').innerHTML ="";
                     document.getElementById('month1').innerHTML ="";
                     document.getElementById('pnumber1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('hpdate1').innerHTML ="";
                     document.getElementById('travelhis1').innerHTML =""
                      document.getElementById('travelper1').innerHTML ="";
                       document.getElementById('near1').innerHTML ="";
                         document.getElementById('pnumber121').innerHTML ="";
                         document.getElementById('pnumber122').innerHTML ="";
                     // document.getElementById('mnpa1').innerHTML ="";
                      document.getElementById('getloc').innerHTML ="";

                    }

                    else if(regex_name.test(n)==false){
                      document.getElementById('pname1').innerHTML ="<br>Use only Alphabets";
                        document.getElementById('dist1').innerHTML ="";
                        document.getElementById('blockur0').innerHTML ="";
                     document.getElementById('pgender3').innerHTML ="";
                     document.getElementById('age1').innerHTML ="";
                     document.getElementById('month1').innerHTML ="";
                     document.getElementById('pnumber1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('hpdate1').innerHTML ="";
                     document.getElementById('travelhis1').innerHTML =""
                      document.getElementById('travelper1').innerHTML ="";
                       document.getElementById('near1').innerHTML ="";
                         document.getElementById('pnumber121').innerHTML ="";
                         document.getElementById('pnumber122').innerHTML ="";
                         document.getElementById('rates1').innerHTML ="";
                         // document.getElementById('rural_urban_layer1').innerHTML ="";
                     // document.getElementById('mnpa1').innerHTML ="";
                      document.getElementById('getloc').innerHTML ="";

                    }

                    else if(!gender1.checked && !gender2.checked){
                       document.getElementById('pgender3').innerHTML ="Select Gender";
                         document.getElementById('dist1').innerHTML ="";
                         document.getElementById('blockur0').innerHTML ="";
                     document.getElementById('pname1').innerHTML ="";
                     document.getElementById('age1').innerHTML ="";
                     document.getElementById('month1').innerHTML ="";
                     document.getElementById('pnumber1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('hpdate1').innerHTML ="";
                     document.getElementById('travelhis1').innerHTML =""
                      document.getElementById('travelper1').innerHTML ="";
                       document.getElementById('near1').innerHTML ="";
                         document.getElementById('pnumber121').innerHTML ="";
                         document.getElementById('pnumber122').innerHTML ="";
                         document.getElementById('rates1').innerHTML ="";
                         // document.getElementById('rural_urban_layer1').innerHTML ="";
                     // document.getElementById('mnpa1').innerHTML ="";
                      document.getElementById('getloc').innerHTML ="";
                    }

                    else if(age.trim() == ""){
                     document.getElementById('rates1').innerHTML ="";
                      document.getElementById('age1').innerHTML ="<br>Please fill age";
                        document.getElementById('dist1').innerHTML ="";
                        document.getElementById('blockur0').innerHTML ="";
                     document.getElementById('pname1').innerHTML ="";
                     document.getElementById('pgender3').innerHTML ="";
                     document.getElementById('month1').innerHTML ="";
                     document.getElementById('pnumber1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('hpdate1').innerHTML ="";
                     document.getElementById('travelhis1').innerHTML =""
                      document.getElementById('travelper1').innerHTML ="";
                       document.getElementById('near1').innerHTML ="";
                         document.getElementById('pnumber121').innerHTML ="";
                         document.getElementById('pnumber122').innerHTML ="";
                         // document.getElementById('rural_urban_layer1').innerHTML ="";
                     // document.getElementById('mnpa1').innerHTML ="";
                      document.getElementById('getloc').innerHTML ="";
                    }

                    else if(pmonth == 13){
                     document.getElementById('month1').innerHTML ="<br>Please fill month";
                       document.getElementById('dist1').innerHTML ="";
                       document.getElementById('blockur0').innerHTML ="";
                     document.getElementById('pname1').innerHTML ="";
                     document.getElementById('pgender3').innerHTML ="";
                     document.getElementById('age1').innerHTML ="";
                     document.getElementById('pnumber1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('hpdate1').innerHTML ="";
                     document.getElementById('travelhis1').innerHTML =""
                      document.getElementById('travelper1').innerHTML ="";
                       document.getElementById('near1').innerHTML ="";
                         document.getElementById('pnumber121').innerHTML ="";
                         document.getElementById('pnumber122').innerHTML ="";
                         document.getElementById('rates1').innerHTML ="";
                         // document.getElementById('rural_urban_layer1').innerHTML ="";
                     // document.getElementById('mnpa1').innerHTML ="";
                      document.getElementById('getloc').innerHTML ="";
                    }

                    else if(phone.trim() == ""){
                       document.getElementById('pnumber1').innerHTML ="Please fill Phone number";
                         document.getElementById('dist1').innerHTML ="";
                         document.getElementById('blockur0').innerHTML ="";
                     document.getElementById('pname1').innerHTML ="";
                     document.getElementById('pgender3').innerHTML ="";
                     document.getElementById('age1').innerHTML ="";
                     document.getElementById('month1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('hpdate1').innerHTML ="";
                     document.getElementById('travelhis1').innerHTML =""
                      document.getElementById('travelper1').innerHTML ="";
                       document.getElementById('near1').innerHTML ="";
                         document.getElementById('pnumber121').innerHTML ="";
                         document.getElementById('pnumber122').innerHTML ="";
                         document.getElementById('rates1').innerHTML ="";
                         // document.getElementById('rural_urban_layer1').innerHTML ="";
                     // document.getElementById('mnpa1').innerHTML ="";
                      document.getElementById('getloc').innerHTML ="";
                    }
                    else if (regex_phone.test(phone)==false ) {
                     document.getElementById('pnumber1').innerHTML ="Phone number must be 10 digit";
                       document.getElementById('dist1').innerHTML ="";
                       document.getElementById('blockur0').innerHTML ="";
                     document.getElementById('pname1').innerHTML ="";
                     document.getElementById('pgender3').innerHTML ="";
                     document.getElementById('age1').innerHTML ="";
                     document.getElementById('month1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('hpdate1').innerHTML ="";
                     document.getElementById('travelhis1').innerHTML =""
                      document.getElementById('travelper1').innerHTML ="";
                       document.getElementById('near1').innerHTML ="";
                         document.getElementById('pnumber121').innerHTML ="";
                         document.getElementById('pnumber122').innerHTML ="";
                         document.getElementById('rates1').innerHTML ="";
                         // document.getElementById('rural_urban_layer1').innerHTML ="";
                     // document.getElementById('mnpa1').innerHTML ="";
                      document.getElementById('getloc').innerHTML ="";
                    }

                   else if(dat.trim() == ""){
                    document.getElementById('hpdate1').innerHTML ="Please fill Hospitalization date";
                    document.getElementById('hpdate1').focus();
                      document.getElementById('dist1').innerHTML ="";
                      document.getElementById('blockur0').innerHTML ="";
                     document.getElementById('pname1').innerHTML ="";
                     document.getElementById('pgender3').innerHTML ="";
                     document.getElementById('age1').innerHTML ="";
                     document.getElementById('month1').innerHTML ="";
                     document.getElementById('pnumber1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('travelhis1').innerHTML =""
                      document.getElementById('travelper1').innerHTML ="";
                       document.getElementById('near1').innerHTML ="";
                         document.getElementById('pnumber121').innerHTML ="";
                         document.getElementById('pnumber122').innerHTML ="";
                         document.getElementById('rates1').innerHTML ="";
                         // document.getElementById('rural_urban_layer1').innerHTML ="";
                     // document.getElementById('mnpa1').innerHTML ="";
                      document.getElementById('getloc').innerHTML ="";
                    }
                    else if(trav.trim() == ""){
                    document.getElementById('travelhis1').innerHTML ="Select Option";
                      document.getElementById('dist1').innerHTML ="";
                      document.getElementById('blockur0').innerHTML ="";
                     document.getElementById('pname1').innerHTML ="";
                     document.getElementById('pgender3').innerHTML ="";
                     document.getElementById('age1').innerHTML ="";
                     document.getElementById('month1').innerHTML ="";
                     document.getElementById('pnumber1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('hpdate1').innerHTML ="";
                      document.getElementById('travelper1').innerHTML ="";
                       document.getElementById('near1').innerHTML ="";
                         document.getElementById('pnumber121').innerHTML ="";
                         document.getElementById('pnumber122').innerHTML ="";
                         document.getElementById('rates1').innerHTML ="";
                         // document.getElementById('rural_urban_layer1').innerHTML ="";
                     // document.getElementById('mnpa1').innerHTML ="";
                      document.getElementById('getloc').innerHTML ="";
                    }
                    else if(travf.trim() == ""){
                    document.getElementById('travelper1').innerHTML ="Select Option";
                      document.getElementById('dist1').innerHTML ="";
                      document.getElementById('blockur0').innerHTML ="";
                     document.getElementById('pname1').innerHTML ="";
                     document.getElementById('pgender3').innerHTML ="";
                     document.getElementById('age1').innerHTML ="";
                     document.getElementById('month1').innerHTML ="";
                     document.getElementById('pnumber1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('hpdate1').innerHTML ="";
                     document.getElementById('travelhis1').innerHTML ="";
                     document.getElementById('near1').innerHTML ="";
                     document.getElementById('pnumber121').innerHTML ="";
                     document.getElementById('pnumber122').innerHTML ="";
                     document.getElementById('rates1').innerHTML ="";
                      document.getElementById('getloc').innerHTML ="";
                    }
                    else if(nearby.trim() == ""){
                    document.getElementById('near1').innerHTML ="Select Option";
                      document.getElementById('dist1').innerHTML ="";
                      document.getElementById('blockur0').innerHTML ="";
                     document.getElementById('pname1').innerHTML ="";
                     document.getElementById('pgender3').innerHTML ="";
                     document.getElementById('age1').innerHTML ="";
                     document.getElementById('month1').innerHTML ="";
                     document.getElementById('pnumber1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('hpdate1').innerHTML ="";
                     document.getElementById('travelhis1').innerHTML =""
                      document.getElementById('travelper1').innerHTML ="";
                      // document.getElementById('rural_urban_layer1').innerHTML ="";
                     // document.getElementById('mnpa1').innerHTML ="";
                         document.getElementById('pnumber121').innerHTML ="";
                         document.getElementById('pnumber122').innerHTML ="";
                         document.getElementById('rates1').innerHTML ="";
                          document.getElementById('getloc').innerHTML ="";
                    }
                    else if(contact.trim() == ""){
                    document.getElementById('pnumber121').innerHTML ="Enter Contact";
                      document.getElementById('dist1').innerHTML ="";
                      document.getElementById('blockur0').innerHTML ="";
                     document.getElementById('pname1').innerHTML ="";
                     document.getElementById('pgender3').innerHTML ="";
                     document.getElementById('age1').innerHTML ="";
                     document.getElementById('month1').innerHTML ="";
                     document.getElementById('pnumber1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('hpdate1').innerHTML ="";
                     document.getElementById('travelhis1').innerHTML =""
                      document.getElementById('travelper1').innerHTML ="";
                       document.getElementById('near1').innerHTML ="";
                       document.getElementById('pnumber122').innerHTML ="";
                       document.getElementById('rates1').innerHTML ="";
                       // document.getElementById('rural_urban_layer1').innerHTML ="";
                     // document.getElementById('mnpa1').innerHTML ="";
                      document.getElementById('getloc').innerHTML ="";

                    }
                    else if(regex_phone.test(contact)==false ){
                    document.getElementById('pnumber121').innerHTML ="Phone Number should be 10 digits";
                      document.getElementById('dist1').innerHTML ="";
                      document.getElementById('blockur0').innerHTML ="";
                     document.getElementById('pname1').innerHTML ="";
                     document.getElementById('pgender3').innerHTML ="";
                     document.getElementById('age1').innerHTML ="";
                     document.getElementById('month1').innerHTML ="";
                     document.getElementById('pnumber1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('hpdate1').innerHTML ="";
                     document.getElementById('travelhis1').innerHTML =""
                      document.getElementById('travelper1').innerHTML ="";
                       document.getElementById('near1').innerHTML ="";
                        document.getElementById('pnumber122').innerHTML ="";
                        document.getElementById('rates1').innerHTML ="";
                        // document.getElementById('rural_urban_layer1').innerHTML ="";
                     // document.getElementById('mnpa1').innerHTML ="";
                      document.getElementById('getloc').innerHTML ="";

                    }
                     else if (contact2!="") {
                       if(regex_phone.test(contact2)==false ){
                    document.getElementById('pnumber122').innerHTML ="Phone Number should be 10 digits";
                      document.getElementById('dist1').innerHTML ="";
                      document.getElementById('blockur0').innerHTML ="";
                     document.getElementById('pname1').innerHTML ="";
                     document.getElementById('pgender3').innerHTML ="";
                     document.getElementById('age1').innerHTML ="";
                     document.getElementById('month1').innerHTML ="";
                     document.getElementById('pnumber1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('hpdate1').innerHTML ="";
                     document.getElementById('travelhis1').innerHTML =""
                      document.getElementById('travelper1').innerHTML ="";
                       document.getElementById('near1').innerHTML ="";
                        document.getElementById('pnumber121').innerHTML ="";
                        document.getElementById('rates1').innerHTML ="";
                        // document.getElementById('rural_urban_layer1').innerHTML ="";
                     // document.getElementById('mnpa1').innerHTML ="";
                      document.getElementById('getloc').innerHTML ="";

                    }
                  }
                  else if (lat.trim()=="" && long.trim()=="") {
                     document.getElementById('getloc').innerHTML ="Please click on Get Location.";
                    document.getElementById('pnumber122').innerHTML ="";
                      document.getElementById('dist1').innerHTML ="";
                      document.getElementById('blockur0').innerHTML ="";
                     document.getElementById('pname1').innerHTML ="";
                     document.getElementById('pgender3').innerHTML ="";
                     document.getElementById('age1').innerHTML ="";
                     document.getElementById('month1').innerHTML ="";
                     document.getElementById('pnumber1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('hpdate1').innerHTML ="";
                     document.getElementById('travelhis1').innerHTML =""
                      document.getElementById('travelper1').innerHTML ="";
                       document.getElementById('near1').innerHTML ="";
                        document.getElementById('pnumber121').innerHTML ="";
                        document.getElementById('rates1').innerHTML ="";
                        // document.getElementById('rural_urban_layer1').innerHTML ="";
                     // document.getElementById('mnpa1').innerHTML ="";

                  }
                else{
                       // console.log("Form is correct nw");
                       var element = document.getElementById("hello");

                        element.classList.remove("noload");

                      
                    document.getElementById('getloc').innerHTML ="";
                    document.getElementById('pnumber122').innerHTML ="";
                      document.getElementById('dist1').innerHTML ="";
                      document.getElementById('blockur0').innerHTML ="";
                     document.getElementById('pname1').innerHTML ="";
                     document.getElementById('pgender3').innerHTML ="";
                     document.getElementById('age1').innerHTML ="";
                     document.getElementById('month1').innerHTML ="";
                     document.getElementById('pnumber1').innerHTML ="";
                     document.getElementById('sympdays1').innerHTML ="";
                     document.getElementById('hpdate1').innerHTML ="";
                     document.getElementById('travelhis1').innerHTML =""
                      document.getElementById('travelper1').innerHTML ="";
                       document.getElementById('near1').innerHTML ="";
                        document.getElementById('pnumber121').innerHTML ="";
                        document.getElementById('rates1').innerHTML ="";
                        // document.getElementById('rural_urban_layer1').innerHTML ="";
                     // document.getElementById('mnpa1').innerHTML ="";
                     // console.log("logined");
                    //var s=$('#add_name').serialize();
                       //console.log(s);
                       var myform = document.getElementById("add_name");
                       var fd = new FormData(myform );
                       /*$.ajax({
                       url:"data.php",
                       data: fd,
                       method:"POST",
                       success(data)
                       {

                           console.log(data);
                           i=1;
                           $('.dynamic-added').remove();
                           $('#add_name')[0].reset();
                          // alert('Record Inserted Successfully.');
                       }
                  });*/

                  $.ajax({
                          url: 'data.php',
                          type: 'POST',
                          dataType: 'text',
                          processData: false,
                          contentType: false,
                          data: fd
                       })
                       .done(function(res) {
                        var element = document.getElementById("hello");
                        element.classList.add("noload");
                          console.log("success");
                          console.log(res);
                        document.getElementById("add_name").reset();
                        alert("Submitted Saved Successfully");
                       })
                       .fail(function() {
                        var element = document.getElementById("hello");
                        element.classList.add("noload");
                        alert("Network Issue. Please Try Again.");
                          console.log("error");
                       })
                       .always(function() {
                          console.log("complete");
                       });//ajaxend
                }//else close
                  }//fun end


          
                  


         });



         });
      </script>
      <script type="text/javascript">
     $(document).ready(function(){
       var postURL = "/addmore.php";
       var i=1;


       $('#add').click(function(){
            i++;
            $('#dynamic_field').append('<tr id="row'+i+'" class="dynamic-added"><td><input type="text" name="place[]" placeholder="Enter Name" class="form-control name_list" required /></td><td><input type="date" name="date1[]" placeholder="Enter Date" class="form-control name_list" required="" /></td><td><button type="button" name="remove" id="'+i+'" class="btn btn-danger btn_remove">X</button></td></tr>');
       });


       $(document).on('click', '.btn_remove', function(){
            var button_id = $(this).attr("id");
            $('#row'+button_id+'').remove();
       });

     });
 </script>


      <script>
         $("#travelhis").change(function() {
         if ($(this).val() == "1") {
         $('#otherfieldiv').show();
         $('#dynamic_field').attr('required', '');
         $('#dynamic_field').attr('data-error', 'This field is required.');
         } else {
         $('#otherfieldiv').hide();
         $('#dynamic_field').removeAttr('required');
         $('#dynamic_field').removeAttr('data-error');
         }
         });
         $("#travelhis").trigger("change");


      </script>
      <script type="text/javascript">
         $(document).ready(function(){
           var postURL = "/addmore.php";
           var i=1;


           $('#add2').click(function(){
                i++;
                $('#dynamic_field2').append('<tr id="row'+i+'" class="dynamic-added"> <td><input type="text" name="place2[]"id="otherfield21" placeholder="Enter Place" class="form-control name_list" required="" /></td><td><input type="date" name="date2[]"id="otherfield22" placeholder="Enter Date" class="form-control name_list" required="" /></td> <td><button type="button" name="remove" id="'+i+'" class="btn btn-danger btn_remove">X</button></td></tr>');
           });
         // $('#add2').click(function(){
         //           i++;
         //           $('#dynamic_field2').append('<tr id="row'+i+'" class="dynamic-added"><td><button type="button" name="remove" id="'+i+'" class="btn btn-danger btn_remove">X</button></td></tr>');
         //      });


           $(document).on('click', '.btn_remove', function(){
                var button_id = $(this).attr("id");
                $('#row'+button_id+'').remove();
           });





         });
      </script>
      <script>
         $("#travelper").change(function() {
         if ($(this).val() == "1") {
         $('#tperson').show();
         $('#otherfieldiv2').show();
         $('#dynamic_field2').attr('required', '');
         $('#dynamic_field2').attr('data-error', 'This field is required.');
         } else {
         $('#tperson').hide();
         $('#otherfieldiv2').hide();
         $('#dynamic_field2').removeAttr('required');
         $('#dynamic_field2').removeAttr('data-error');
         }
         });
         $("#travelper").trigger("change");


      </script>
      <script type="text/javascript">
         $(document).ready(function(){
           var postURL = "/addmore.php";
           var i=1;


           $('#add1').click(function(){
                i++;
                $('#dynamic_field1').append('<tr id="row'+i+'" class="dynamic-added"><td><input type="text" name="name3[]" placeholder="Enter Name" class="form-control name_list" required /></td><td><input type="number" name="age3[]" placeholder="Enter Age" class="form-control name_list" required="" /></td><td> <select id="otherfield13" name="sex3[]" class="form-control"required><option disabled selected value>Sex</option><option value="1"> Male</option><option value="0">Female</option></select></td><td><button type="button" name="remove" id="'+i+'" class="btn btn-danger btn_remove">X</button></td></tr>');
           });
         // $('#add1').click(function(){
         //           i++;
         //           $('#dynamic_field1').append('<tr id="row'+i+'" class="dynamic-added"></tr>');
         //      });
         //        $('#add1').click(function(){
         //           i++;
         //           $('#dynamic_field1').append('<tr id="row'+i+'" class="dynamic-added"> <td><button type="button" name="remove" id="'+i+'" class="btn btn-danger btn_remove">X</button></td></tr>');
         //      });



           $(document).on('click', '.btn_remove', function(){
                var button_id = $(this).attr("id");
                $('#row'+button_id+'').remove();
           });




         });
      </script>
      <script>
         $("#near").change(function() {
         if ($(this).val() == "1") {
         $('#nopatients').show();
         $('#otherfieldiv1').show();
         $('#dynamic_field1').attr('required', '');
         $('#dynamic_field1').attr('data-error', 'This field is required.');
         } else {
         $('#nopatients').hide();
         $('#otherfieldiv1').hide();
         $('#dynamic_field1').removeAttr('required');
         $('#dynamic_field1').removeAttr('data-error');
         }
         });
         $("#near").trigger("change");


      </script>
      <script>
         $("#dist").change(function() {
         if ($(this).val() == "1") {
         $('#rates').show();
         } else {
         $('#rates').hide();
         }
         });
         $("#dist").trigger("change");


      </script>

   </body>
</html>
