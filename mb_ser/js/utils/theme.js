let Dark = true;;

let BatPath = "img/drk/";

let DTemp = window.localStorage.getItem("ThemeDark");
if (DTemp != null) {
    Dark = DTemp!="true";
    ToggleTheme();
}

function ToggleTheme(){
    var sheets = document.styleSheets;
    Dark = !Dark;

    window.localStorage.setItem("ThemeDark",Dark);

    let src = BatPath;
    let nav_con = document.getElementById('nav_con');

    if (!Dark) {document.getElementById('TopBar').color="light"; BatPath="img/";}
    else { document.getElementById('TopBar').color="dark"; BatPath="img/drk/";}

    if (src!=BatPath) nav_con.src=nav_con.src.replace(src,BatPath);

    nav_con.parentElement.innerHTML=nav_con.parentElement.innerHTML;

    for (let i=0;i<sheets.length;i++){
        if (sheets[i].href && sheets[i].href.endsWith("drk_theme.css")){
            sheets[i].disabled=!Dark;
        }
    }
}