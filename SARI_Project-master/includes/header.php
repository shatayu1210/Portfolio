<head>
    <link rel="stylesheet" href="../css/footer.css">
</head>

<nav class="navbar stroke sticky-top navbar-expand-lg navbar-dark">
<a class="navbar-brand" href="./login.php">Saari</a>
<a class="navbar-brand" href="./ashaworkerslogin.php">Survey</a>
<button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
 <span class="navbar-toggler-icon"></span>
</button>
<div class="collapse navbar-collapse" id="navbarSupportedContent">
 <ul class="navbar-nav mr-auto">




   <?php if (isset($_SESSION['Did'])) { ?>
     <li class="nav-item active">
       <a class="nav-link" href="./dashboard.php">Dashboard <span class="sr-only">(current)</span></a>
     </li>
    <?php } ?>


    <?php
      if (isset($_SESSION['logintype'])) {
          ?>
        <ul class="nav justify-content-end">
            <li class="nav-item">
                <a class="nav-link" href="./logout.php">Log Out <span class="sr-only">(current)</span></a>
            </li>
        </ul>
    <?php
      }
      ?>
 </ul>
</div>
</nav>
