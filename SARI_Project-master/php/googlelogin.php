<?php
session_start();

$id = isset($_SESSION['userid']) ? $_SESSION['userid'] : '';

if($id != '')
{
    // <script type='text/javascript'>alert('$message');</script>
  //  echo "<script type='text/javascript'>alert('You have signed in ');</script>";
  //  header('Location: ../php/index.php');
    // echo '<script language="javascript">window.location ="../php/index.php"</script>';
    echo "<script>
    if ( window.history.replaceState ) {
        window.history.replaceState( null, null, window.location.href );
    }
</script>";
  
}

?>

<html lang="en">
  <head>
    <meta name="google-signin-scope" content="profile email">
    <meta name="google-signin-client_id" content="857669667433-q9t562ka62p2psetocgsod54nclaa5j5.apps.googleusercontent.com">
    <script src="https://apis.google.com/js/platform.js" async defer></script>
  </head>
  <body>
  <form action="index.php" method="POST">
  <!-- <input type="hidden" id="custId" name="custId" value="3487"> -->
  <input type="hidden" name="email" id="email" value=""><br><br>
  <input type="hidden" name="id" id="id" value="">
  <button class="g-signin2 btn btn-danger" data-onsuccess="onSignIn" data-theme="dark" onclick()="reply_click()"></button>
  <br><br>
  <input type="submit" id="goahead" value="Go Ahead" />
</form> 
    <!-- <button class="g-signin2" data-onsuccess="onSignIn" data-theme="dark" onclick="get()"></button> -->
    <script>
    document.getElementById("goahead").disabled = true; 

  //   function reply_click()
  // {
  //   console.log("dassda");
  //   document.getElementById("goahead").disabled = false; 
  // }
   
    //  var check=sessionStorage.getItem("email");

    //  if(check != null){
    //   // window.location.replace('index.php');
    //   // window.location = "index.php";
    //    console.log(check);
    //  }

      function onSignIn(googleUser) {
        
        // Useful data for your client-side scripts:
        var profile = googleUser.getBasicProfile();
        console.log("ID: " + profile.getId()); // Don't send this directly to your server!
        console.log('Full Name: ' + profile.getName());
        console.log('Given Name: ' + profile.getGivenName());
        console.log('Family Name: ' + profile.getFamilyName());
        console.log("Image URL: " + profile.getImageUrl());
        console.log("Email: " + profile.getEmail());

        // The ID token you need to pass to your backend:
        var id_token = googleUser.getAuthResponse().id_token;
        console.log("ID Token: " + id_token);
        var email = profile.getEmail();
        var id = profile.getId();
        
        document.getElementById("email").value= email;
        document.getElementById("id").value=id;
        document.getElementById("goahead").disabled = false; 
        // sessionStorage.setItem("email",profile.getEmail());
        // window.location = "index.php";
        // window.location.replace('index.php');
      }
     
    </script>
  </body>
</html>
