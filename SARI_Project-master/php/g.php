<!-- <!DOCTYPE html> -->
<html>
<body>

<p>Click the button to get your coordinates.</p>

<button onclick="getLocation()">Try It</button>
<button onclick="hello()">Transfer</button>

<p id="demo"></p>

<script language="JavaScript" type="text/javascript" src="/js/jquery-1.2.6.min.js"></script>
<script language="JavaScript" type="text/javascript" src="/js/jquery-ui-personalized-1.5.2.packed.js"></script>
<script language="JavaScript" type="text/javascript" src="/js/sprinkle.js"></script>
<script src="//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js"></script>
<script type="text/javascript">
// <script>
var x = document.getElementById("demo");
var lat;
var long;
function hello(){
                    $.ajax({
                        url : "transfer.php?lat="+lat+"&long="+long,
                        cache : false,
                        complete : function($response, $status){
                        //  console.log($response.responseText);
                            if ($status != "error" && $status != "timeout") {
                                console.log($response.responseText);
                                
                            }
                        },
                        error : function ($responseObj){
                            alert("Something went wrong while processing your request.\n\nError => "
                                + $responseObj.responseText);
                        }
                    });
}


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
  lat=position.coords.latitude;
  long=position.coords.longitude;
  
}







</script>

</body>
</html>