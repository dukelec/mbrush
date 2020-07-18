let Dark = true;

let DTemp = window.localStorage.getItem("ThemeDark");
if (DTemp != null) {
    Dark = DTemp!="true";
    ToggleTheme();
}

function ToggleTheme(){
    var sheets = document.styleSheets;
    Dark = !Dark;

    window.localStorage.setItem("ThemeDark",Dark);

    if (!Dark) {document.getElementById('TopBar').color="light"; BatPath="img/";}
    else { document.getElementById('TopBar').color="dark"; BatPath="img/drk/";}

    for (let i=0;i<sheets.length;i++){
        if (sheets[i].href && sheets[i].href.endsWith("drk_theme.css")){
            sheets[i].disabled=!Dark;
        }
    }
}