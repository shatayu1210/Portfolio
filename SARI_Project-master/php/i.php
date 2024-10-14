<?php
     include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'dbconn.php';
     // $phpVar =  $_COOKIE['latti'];
     // $phpVar1 =  $_COOKIE['longi'];
     // echo $phpVar;
     // echo $phpVar1;
?>
<!DOCTYPE html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8">
      <meta content="width=device-width, initial-scale=1" name="viewport"/>
    <title>Sari</title>
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css" integrity="sha384-Vkoo8x4CGsO3+Hhxv8T/Q5PaXtkKtu6ug5TOeNV6gBiFeWPGFN9MuhOf23Q9Ifjh" crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
    <link rel="stylesheet" href="../css/animate.css">
    <link rel="stylesheet" href="../css/footer.css">
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
    //  include dirname(dirname(__FILE__)).DIRECTORY_SEPARATOR.'includes'.DIRECTORY_SEPARATOR.'header.php';
    ?>
  <!--Content-->
    <br><br><br>
    <div class="dashcard1 animated zoomIn">
      <h3 style="text-align:center; font-weight: 600;">SARI Survey</h3><br>
      <!-- <form class="" action="./data.php" id="add_name" method="post"> -->
      <form class="" id="add_name">
      <div class="alert alert-danger display-error" style="display: none"></div>
       <div class="row">
            <div class="col">
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
          </select><br>

        </div>

       <div class="col">

          <div id="rates">
            <label for="rates">Area:</label><br>
    <input type="radio" id="r1" name="rate" value="Urban" onChange="urbanSelected()"> Urban
    <input type="radio" id="r2" name="rate" value="Rural" onChange="ruralSelected()"> Rural
  </div>
        </div>
      </div>

         <div class="row">
        <div class="col">
          <div id='rural_urban_layer' ></div>
      </div>
      <div class="col">
        <div id='mnpa'></div>
      </div>
    </div>
      <div class="row">
        <div class="col">
          <div id='phclayer' ></div>
        </div>
        <div class="col">
        <div id='subcenter'></div>
      </div>
        </div>
        <div class="row">
      <div class="col">
        <div id='village'></div>
      </div>
      <div class="col">
    </div>
    </div>
  <div class="row">
      <div class="col">
      <div class="form-group">
        <label for="pname">Patients Name</label>
        <input type="text" name="pname" class="form-control" id="pname" placeholder="Full Name">
          <small>First Name  /   Middle Name   /  Last Name</small>
      </div>
    </div>
  </div>
  <div class="row">
    <div class="form-group">
      <label for="pgender">Gender</label>
      <div class="radio">
      <label><input type="radio" id="pgender" value="1"name="optradiopgen" > Male</label>
    </div>
    <div class="radio">
      <label><input type="radio" id="pgender" value="0" name="optradiopgen"> Female</label>
    </div>
  </div>
</div>
<div class="row">
  <div class="col">
  <div class="form-group">
    <label for="age">Age</label>
    <input type="number" name="pageyears" class="form-control" id="age" placeholder="Year">
    <small>Years</small>
  </div>
</div>

    <div class="col">
      <div class="form-group">
        <label for="month">Months</label>
    <select id="month" name='pagemonths' class="form-control">
    <option disabled selected value>Select Months</option>
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
</div>
  </div>
</div>
<div class="row">
  <div class="col">
  <div class="form-group">
    <label for="pnumber">Patients Phone Number</label>
    <input type="text" name="patnumber" class="form-control" id="pnumber" placeholder="Patient Phone number">
  </div>
</div>
</div>
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
    <input type="text" name="sympdays" class="form-control" id="sympdays" placeholder="Since when">
  </div>
</div>
<div class="col">
<div class="form-group">
  <label for="hpdate">Date of Hospitalization</label>
  <input type="date" name="hpdate" class="form-control" id="hpdate" placeholder="Since when">
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
</div>
  </div>
          </div>
          <div class="row">
  <div class="col">
  <div class="form-group" id="otherfieldiv">
    <label for="dynamic_field">Enter Place & Date:</label>
                             <table class="table table-bordered" id="dynamic_field">
                    <tr>
                        <td><input type="text" name="place[]"id="otherfield1" placeholder="Enter Place" class="form-control name_list"  /></td>
                         <td><input type="date" name="date1[]"id="otherfield2" placeholder="Enter Date" class="form-control name_list"  /></td>
                        <td><button type="button" name="add" id="add" class="btn btn3">Add More</button></td>
                    </tr>
                </table>
  </div>
</div></div>
               <div class="row">
  <div class="col">
    <div class="form-group">
      <label for="travelper">Any Travelled Person in Family</label>
      <select id="travelper" name='travelper' class="form-control">
        <option disabled selected value>Select option</option>
        <option value="1">Yes</option>
        <option value="0">No</option>
</select>
</div>
  </div></div>
<div class="row">
                  <div class="col">
    <div class="form-group"id="tperson">
      <label for="tperson">If Yes, how many person</label>
      <input type="number" name="nopatientstravel" class="form-control"/>
</div></div><div class="col"></div></div>

                  <div class="col">
  <div class="form-group" id="otherfieldiv2">
    <label for="dynamic_field2">Mention Place and date:</label>
                             <table class="table table-bordered" id="dynamic_field2">
                    <tr>
                        <td><input type="text" name="place2[]"id="otherfield21" placeholder="Enter Place" class="form-control name_list"/></td>
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
</div>
</div></div>
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
                             <table class="table table-bordered" id="dynamic_field1">
                               <tr>
                        <td><input type="text" name="name3[]"id="otherfield11" placeholder="Enter Name" class="form-control name_list"/></td>
                         <td><input type="number" name="age3[]"id="otherfield12" placeholder="Enter Age" class="form-control name_list"/></td>
                        <td>
                        <select id="otherfield13" name='sex3[]' class="form-control">
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
                  <input type="text" name="pccontact1" class="form-control" id="pnumber12" placeholder="Contact No. 1">
                </div>
              </div>
              <div class="col">
                <div class="form-group">
                  <label for="pnumber13">Contact Number 2</label>
                  <input type="text" name="pccontact2" class="form-control" id="pnumber13" placeholder="Contact No. 2">
                </div>
              </div>
            </div>
            <input type="button" style="width:34%;" class="btn btn3" onclick="getLocation()"value="Get Location"/><br><small>Allow Location Access On Your Device</small>
            <p id="demo" ></p>

            <input type="hidden" id="lat" name="lat" />
            <input type="hidden" id="long" name="long" />
<br><br>
       <div class="text-center">

              <input type="submit"  id="submit" name="surveycompleted" class="btn btn2" value="Submit">
        </div>

   </div>
      </form>
<br><br><br>  <!--Footer-->
<footer class="footer-distributed">

<div class="footer-left"><!--Left-->
   <img src="../images/bluelogo.jpg"><br><br>
 <h3>Saari Survey</h3>
</div>
<div class="footer-center"><!--Center-->
      <div><p class="footerbold">Somaiya College Contributors and Developers</p></div>
      <p>Ritesh Sandbhor<br>Sahil More<br>Yash Deshpande<br>Shatayu Thakur</p>
</div>
<div class="footer-right"><!--Right-->
      <p class="footerbold">Doctors</p>
      <p>Dr. Pimple Aniruddha<br>
         Dr. Shrikant Kulkarni<br>
         Mr. Shridhar Kalshetti</p>
    </div>
  </footer>
      <script>
      var x = document.getElementById("demo");

      function getLocation() {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(showPosition);
        } else {
          x.innerHTML = "Geolocation is not supported by this browser.";
        }
      }

      function showPosition(position) {
        x.innerHTML = "Latitude: " + position.coords.latitude +
        "<br>Longitude: " + position.coords.longitude;
        document.getElementById("lat").value =position.coords.latitude ;
          document.getElementById("long").value =position.coords.longitude ;
      }
      </script>



<script language="JavaScript" type="text/javascript" src="/js/jquery-1.2.6.min.js"></script>
<script language="JavaScript" type="text/javascript" src="/js/jquery-ui-personalized-1.5.2.packed.js"></script>
<script language="JavaScript" type="text/javascript" src="/js/sprinkle.js"></script>
<script src="//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js"></script>






<script type="text/javascript">
//FORM SUBMIT

$(function(){
          
//AJAX SUBMIT FORM
// $(document).ready(function(){
$('#submit').click(function(e){
  
  e.preventDefault();
  
// console.log('sdas');



  var dist = $("#dist").val();
  var rate = $("#rate").val();
  var pname = $("#pname").val();
  var optradiopgen = $("#optradiopgen").val();
  var pageyears = $("#pageyears").val();
  var pagemonths = $("#pagemonths").val();
// console.log('pass vars');

  // var patnumber = $("#patnumber").val();
  // var pccontact1 = $("#pccontact1").val();
  // var pccontact2 = $("#pccontact2").val();
  // var fever = $("#fever").val();
  // var breathlessness = $("#breathlessness").val();
  // var othersymptoms = $("#othersymptoms").val();
  // var sympdays = $("#sympdays").val();
  // var hpdate = $("#hpdate").val();
  // var Hypertension = $("#Hypertension").val();
  // var Diabetes = $("#Diabetes").val();
  // var Cardiac = $("#Cardiac").val();
  // var Respiratory = $("#Respiratory").val();
  // var Cancer = $("#Cancer").val();
  // var Pregnant = $("#Pregnant").val();
  // var otherimmuno = $("#otherimmuno").val();
  // var block = $("#block").val();
  // var phc = $("#phc").val();
  // var subcenter = $("#subcenter").val();
  // var village = $("#village").val();
  // var mnpa = $("#mnpa").val();
  // var travelhis = $("#travelhis").val();
  // var travelper = $("#travelper").val();
  // var nopatientstravel = $("#nopatientstravel").val();
  // var nopatients1 = $("#nopatients1").val();
  // var place = $("#place").val();
  // var date1 = $("#date1").val();
  // var place2 = $("#place2").val();
  // var date2 = $("#date2").val();
  // var name3 = $("#name3").val();
  // var age3 = $("#age3").val();
  // var sex3 = $("#sex3").val();

  // $.ajax({
  //        url : "data1.php",
  //        cache : false,
  //        complete : function($response, $status){
  //         //  console.log($response.responseText);
  //            if ($status != "error" && $status != "timeout") {
  //                $('#rural_urban_layer').html($response.responseText);
  //            }
  //        },
  //        error : function ($responseObj){
  //            alert("Something went wrong while processing your request.\n\nError => "
  //                + $responseObj.responseText);
  //        }
  //    });
  $.ajax({
      type: "POST",  
      url: "data1.php",
      dataType: 'json',
      data: {dist:dist,rate:rate,pname:pname,optradiopgen:optradiopgen,pageyears:pageyears,pagemonths:pagemonths},
      
      success : function(data){

          if (data.code == "200"){
            console.log('dsdsa');
              alert("Success: " +data.msg);

          } else{
            console.log(data.msg);

              $(".display-error").html("<ul>"+data.msg+"</ul>");

              $(".display-error").css("display","block");
          }
      }
  });


});

// }console.log("the document is ready")
});



//------------------------URBAN--------------------------------------------

    //URBAN-Block
    function urbanSelected(){
      $("#mnpa").show();
      $("#phclayer").hide();
      $("#subcenter").hide();
      $("#village").hide();
      // var link = document.getElementById('phclayer');
      // link.style.display = 'none';
      var e = document.getElementById("dist");
    var u_id = e.options[e.selectedIndex].value;
      // console.log($d_id);
     $.ajax({
         url : "blockurban.php?u_id="+u_id,
         cache : false,
         complete : function($response, $status){
          //  console.log($response.responseText);
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
          //  console.log($response.responseText);
             if ($status != "error" && $status != "timeout") {
                 $('#mnpa').html($response.responseText);
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
  $("#mnpa").hide();
  $("#phclayer").show();
      $("#subcenter").show();
      $("#village").show();
      var e = document.getElementById("dist");
    var d_id = e.options[e.selectedIndex].value;
      // console.log($d_id);
     $.ajax({
         url : "block.php?d_id="+d_id,
         cache : false,
         complete : function($response, $status){
          //  console.log($response.responseText);
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
                 $('#subcenter').html($response.responseText);
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
                 $('#village').html($response.responseText);
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


      $('#submit').click(function(){
           $.ajax({
                url:postURL,
                method:"POST",
                data:$('#add_name').serialize(),
                type:'json',
                success:function(data)
                {
                  	i=1;
                  	$('.dynamic-added').remove();
                  	$('#add_name')[0].reset();
    				       // alert('Record Inserted Successfully.');
                }
           });
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


      // $('#submit').click(function(){
      //      $.ajax({
      //           // url:"data.php",
      //           method:"POST",
      //           data:$('#add_name').serialize(),
      //           type:'json',
      //           success:function(data)
      //           {
      //             	i=1;
      //             	$('.dynamic-added').remove();
      //             	$('#add_name')[0].reset();
    	// 			        //alert('Record Inserted Successfully.');
      //           }
      //      });
      // });


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


      $('#submit').click(function(){
           $.ajax({
                //url:postURL,
                method:"POST",
                data:$('#add_name').serialize(),
                type:'json',
                success:function(data)
                {
                  	i=1;
                  	$('.dynamic-added').remove();
                  	$('#add_name')[0].reset();
    				        //alert('Record Inserted Successfully.');
                }
           });
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
