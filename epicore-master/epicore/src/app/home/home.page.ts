import { Component, ElementRef, ViewChild } from '@angular/core';
import { InAppBrowser } from '@ionic-native/in-app-browser/ngx';
import { FingerprintAIO } from '@ionic-native/fingerprint-aio/ngx';
import { AlertController, Platform } from '@ionic/angular';
import * as jspdf from 'jspdf';
import html2canvas from 'html2canvas';
import { StatusBar } from '@ionic-native/status-bar/ngx';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  browser;
  lastFaceLoginTime=Date.now()-100000;
  configuringAuth=false;
  authSetupStatus:string;
  showSpinner=true;
  tryFaceIDAgain=true;
  lastConfigureAuthTime=Date.now()-60000;

  @ViewChild('cert', {static:false}) cert:ElementRef;


  constructor(private iab: InAppBrowser,
    public faio: FingerprintAIO,
    public alertController: AlertController,
    private platform: Platform,

    
    ) {

  }
  
  doFaceAuth(){
    if (Date.now()-this.lastFaceLoginTime > 10000 && this.tryFaceIDAgain == true ){
      this.lastFaceLoginTime = Date.now();
      console.log("do Face auth...");
  
      //check for face auth 
      //if it passes 
      // execute login script ...with saved cred
      let _this= this;
      this.faio.isAvailable()
      .then(result => {
      if(result === "finger" || result === "face"){
        //Fingerprint or Face Auth is available
        this.faio.show({
          disableBackup: true
      })
      .then((result: any) => {
       if(result == "Success"){
         //Fingerprint/Face was successfully verified
         //Go to dashboard
         _this.fillAuth();
        }
       else {
        //Fingerprint/Face was not successfully verified
        console.log("FP not verified ",result);
        _this.tryFaceIDAgain = false;

       }
     })
     .catch((error: any) => {
       //Fingerprint/Face was not successfully verified
       console.log("ERROR: Could not use Face/Fingerprint to login");
       _this.tryFaceIDAgain = false;

     });
     }
     else {
       //Fingerprint or Face Auth is not available
       console.log("Fingerprint/Face Auth is not available on this device!");
       _this.tryFaceIDAgain = false;
       }
      })
    }else{
      console.log("blocking quick relogin attempt ..."+Date.now())
    }

    
  }

  async configureAuth(){

    this.authSetupStatus = localStorage.getItem("authSetupStatus");
    console.log("configuring auth called...with authsetup = ",this.authSetupStatus)
    if (this.authSetupStatus == "done"){
      this.doFaceAuth();
      return;
    }else if (this.authSetupStatus == "never"){
      console.log("user chose to not do faceauth")
      return;
    }else{

      if (this.configuringAuth){
        console.log("Returning as configuring auth is true")
        return;
      }

      if (Date.now() < this.lastConfigureAuthTime + 45000 ){ 
        //dont ask again within 45 seconds
        return;
      }
  
      this.configuringAuth = true;
      let   buttons = [
        {
          text: 'Never',
          role: 'never',
          handler: () => {
            console.log('No Face Auth');
            localStorage.setItem("authSetupStatus","never");
            this.alertController.dismiss();
            this.browser.show();
          }
        }, {
          text: 'Later',
          handler: () => {
            console.log('Confirm Later');
            localStorage.setItem("authSetupStatus","later");
            this.configuringAuth=false;
            this.lastConfigureAuthTime = Date.now()
            this.alertController.dismiss();
            this.browser.show();
          }
        },
        {
          text: 'Setup Now',
          handler: () => {
            console.log('setup');
            localStorage.setItem("authSetupStatus","now");
            this.alertController.dismiss();
            this.browser.show();
          }
        }
      ]
  
      //ask if they want to 
        const alert = await this.alertController.create({
          header: 'Setup Auto Login?',
          subHeader: 'Using Face or Finger print',
          message: "You could use your device's face/finger auth to login. Would you like to set it up?",
          buttons: buttons
        });
  
        this.authSetupStatus = localStorage.getItem("authSetupStatus");
        console.log("Auth Setup Status is",this.authSetupStatus);
        if (!this.authSetupStatus || this.authSetupStatus == "later"){
          console.log("hiding browser...")
          this.browser.hide();        
          await alert.present();
        }else if (this.authSetupStatus == "done"){
          console.log("doFace Auth being called...")
          this.doFaceAuth();
        }

    }

    
  }


  ionViewDidEnter(){
    this.platform.ready().then(() => {
      let staging_url = "https://www.epicore.org/~saman/dev/epicore/";
      let prod_url = "https://epicore.org";

      this.popup(prod_url,'_blank');
      setTimeout( ()=>{
       this.showSpinner=false    
       this.browser.show(); 
     },6000)
      console.log("home page opened")
    });
   
  }
  
  
  fillAuth(){
    //this.configuringAuth =false;

    console.log("fill auth called...")

    //this.authSetupStatus = localStorage.getItem("authSetupStatus");
    //console.log("[AUTH] status = "+this.authSetupStatus)

    this.browser.executeScript({
      code: `
      var el = document.getElementById('form-container');
      var un = window.localStorage.getItem("u");
      if (!!el && !!un) {
            var ngEl = angular.element(el);
            var scope = ngEl.scope();
            scope.loginForm.$valid = true;
            scope.userLogin({
                'username':window.localStorage.getItem("u"),
                'password':window.localStorage.getItem("p")
            });
      }      
      `
    })
    

   
  }


  popup(url='https://www.epicore.org',mode = '_blank') {
    this.browser = this.iab.create(url,mode,"hidden=yes,toolbar=no,toolbarcolor=#FFFFFF,toolbarposition=top,hidenavigationbuttons=yes,location=no,usewkwebview=no,transitionstyle=crossdissolve");
    this.browser.on('loadstop').subscribe(event => {
        console.log("load stop", event)
        this.browser.show();
        this.showSpinner=false    

        //if (event.url == 'https://epicore.org/#/login') {
        this.browser.executeScript({
          code: `
          function openExternal(link){
            //alert('This link will open in a new window.')
            var ov = window.localStorage.getItem("login-page"); 
            if (!ov.startsWith("lc")){
              window.localStorage.setItem("login-page","lc!"+link+"!"+ov);              
            }
          }

          function modLinks(){
            var elList = document.getElementsByTagName('a');
            for (i=0;i<elList.length;i++){

              if (!elList[i].href.startsWith("javasc")){
                if (!elList[i].href.startsWith("https://www.epicore") && !elList[i].href.startsWith("https://epicore") ){
                  elList[i].href="javascript:openExternal('"+elList[i].href+"');"
                }
  

                if (elList[i].href.indexOf("pdf") != -1){
                  elList[i].href="javascript:openExternal('"+elList[i].href+"');"
                }
              }
             
            }

          }


          function sl(){
            var un = document.getElementById('username');
            var pw = document.getElementById('password');
            window.localStorage.setItem("u",un.value);   
            window.localStorage.setItem("p",pw.value);   
            //var x = window.localStorage.getItem("u");   
            //var y = window.localStorage.getItem("p");   

            doFASetup();
            //alert("x="+x + " and y =" + y);
            //var ov = window.localStorage.getItem("authSetupStatus"); 
            //if (ov == "pendingCred"){
            //  window.localStorage.setItem('authSetupStatus',"done")
            //}
          }

          function doFA(){
            var status = window.localStorage.getItem("authSetupStatus"); 

            if (status == "done"){
              //sign in now..after validation
              console.log("Signing in...");
              var ov = window.localStorage.getItem("login-page"); 
              if (!ov.startsWith("lc")){
                window.localStorage.setItem("login-page","lc!validateForSignIn!"+ov);              
              } 
            }else{
              doFASetup();
            }
          }

          function doFASetup(){
            console.log("Setting up FAuth")
            var ov = window.localStorage.getItem("login-page"); 
            if (!ov.startsWith("lc")){
              window.localStorage.setItem("login-page","lc!validateForSetupAuth!"+ov);              
            }
          }


          function goBack() {
            window.history.back();
          }

          function doPrint(){
            var cpa = document.getElementById('printableArea');
            console.log("XX PRINTING",cpa)
            var ov = window.localStorage.getItem("login-page"); 
            window.localStorage.setItem("cert",cpa.innerHTML)
            window.localStorage.setItem("login-page","lc!print!"+ov)
          }



          function setupFaceIDLink(){     

            console.log("setting up face ID")
            if (document.getElementById("face-id-button")){
              console.log("returning as already face ID")
              return
            }

           var authSetupStatus = window.localStorage.getItem("authSetupStatus"); 


            var inpx = document.createElement("input");
            inpx.type="checkbox"
            inpx.name="face-id-button"
            inpx.id="face-id-button"
            inpx.value="on"
            inpx.style="position:relative; top:6px;font-size:14px;  height:24px; width:24px; background-color:#3fc8c8; border-radius: 50%;border-color:#3fc8c8; color:#3fc8c8; margin-left:10px;"

            var inpl = document.createElement("label");
            inpl.for = "face-id-button"
            inpl.innerText = "Set Up Face ID"
            inpl.style="font-size:14px; color:#3fc8c8; margin-left:6px;"


            var x2 = document.createElement("a");

            var link_text = "Set Up Face ID";
            if (authSetupStatus == "done"){
              link_text = "Sign in with Face ID"
            }

            var link = document.createTextNode(link_text); 

            x2.appendChild(link);  
            x2.id = "face-id-button"
            //x2.onclick=""
            x2.href="javascript:doFA();"
            x2.style="font-size:14px; color:#3fc8c8; margin-left:10px;"
            
            console.log("FA",x2)
            var elList = document.getElementsByTagName('button');

            for (i=0;i<elList.length;i++){
              if (elList[i].type=="submit"){
                console.log(elList[i]); 
                if (authSetupStatus == "done"){
                  elList[i].insertAdjacentElement("afterend",x2);
                }else{
                  elList[i].insertAdjacentElement("afterend",inpl);
                  elList[i].insertAdjacentElement("afterend",inpx);
                }
                console.log("insert done");
              }
            }
                 

          }

          function login() {

            modLinks()

            console.log("checking nav reached login page...")
            var isLoginPage = document.getElementById('username')
            let lpv = window.localStorage.getItem("login-page");              

            if (!isLoginPage){
              if (lpv !="false" && lpv != "done"){
                window.localStorage.setItem("login-page","false");              
              }

              //certificate
              var cpa = document.getElementById('printableArea');
              if (cpa){
                //we are on cert page               
                var bb = document.getElementById('back-button');
                //Hide printbtn
                var pb = document.getElementById('printBtn');
                pb.style.display = "none";

                if (!bb){     

                  var x2= document.createElement("a");
                  var link = document.createTextNode("<< Go Back"); 

                  x2.appendChild(link);  
                  x2.id = "back-button"
                  //x2.onclick="goBack();"
                  x2.href="javascript:goBack();"
                  x2.style="font-size:18px; color:black; position:fixed; top:20px; left:20px;"
                  //cpa.appendChild(x2)      

                  

                }
                          

              }
              return
            }else{
              console.log("On Login Page");

              setupFaceIDLink();
              var authSetupStatus = window.localStorage.getItem("authSetupStatus");
              console.log("Checkbox ==",document.getElementById("face-id-button").checked);

              if (document.getElementById("face-id-button").checked){

                //setup click event here
                var elList = document.getElementsByTagName('button');
                for (i=0;i<elList.length;i++){
                  if (elList[i].type=="submit"){
                    console.log(elList[i]); 
                    elList[i].onclick=function(){ sl()}; 
                  }
                }
                window.localStorage.setItem("login-page","true");  
              }
            }
          }
          let loginInterval = setInterval(()=>{
            login();
          }, 2000)       
        ` 
      });
      
      this.setupOtherLoadStopActions();
    
    });
    //this.browser.hide();
  }


  markFaceAuthSetupDone(ov:any){
    setTimeout(()=>{
      this.browser.executeScript(
        {
          code: `
            console.log("POST AUTH SETUP....",document.getElementById("error_message"))
            if ( !document.getElementById("error_message")){
              console.log('marking fa setup done'); 
              window.localStorage.setItem('login-page','`+ov+`')
              window.localStorage.setItem('authSetupStatus',"done") 
            }else{
              window.localStorage.setItem('login-page','`+ov+`')
              console.log("....fa auth Failed");
            }
            
          `
        })
    },2000)
      
    
  }

  validateFor(action:string, ov:any){
    if (Date.now()-this.lastFaceLoginTime > 3000){
      this.lastFaceLoginTime = Date.now();

      let _this= this;
      this.faio.isAvailable().then(result => {
        if(result === "finger" || result === "face"){
          //Fingerprint or Face Auth is available
          this.faio.show({
            disableBackup: true
          })
          .then((result: any) => {
              if(result == "Success"){
                //Fingerprint/Face was successfully verified
                if (action == "authSetup"){
                  this.markFaceAuthSetupDone(ov)             
                }

                if (action == "sign-in"){
                  this.fillAuth();           
                }
              }else {
                //Fingerprint/Face was not successfully verified
                console.log("FP not verified ",result);
            }
        }).catch((error: any) => {
          //Fingerprint/Face was not successfully verified
          console.log("ERROR: Could not use Face/Fingerprint to login");
          _this.tryFaceIDAgain = false;
          });
        }else{
        //Fingerprint or Face Auth is not available
        console.log("Fingerprint/Face Auth is not available on this device!");
        _this.tryFaceIDAgain = false;
        }
      })
    }else{
      console.log("Not repating vlidation request...");
    }
  }


  openExternal(lp){
    //lp == lc!https://externallink!oldValue
    let lpa = lp.split("!");
    let _this = this;
    console.log("LPA = ",lpa)
    if (lpa[1].indexOf("validateForSetupAuth")!=-1){
      this.validateFor("authSetup",lpa[2]);
    }else if (lpa[1].indexOf("validateForSignIn")!= -1){
      this.validateFor("sign-in",lpa[2]);
    }else if (lpa[1].indexOf("print")!=-1){
      console.log("TO PRINT...");
      //to print
      this.browser.executeScript({
          code: `
            var lp = localStorage.getItem('cert')
            lp
          `
        },function( values ) {
          var lp = values[ 0 ];
          console.log("Printing...",lp, lpa[2])
          _this.doPrint(lp, lpa[2])
        }
      )
    }else{
      let exB = this.iab.create(lpa[1],"_system");
    }   
    
  }


  doPrint(lp:any, ov:any){
    
    let data = lp;  
    this.cert.nativeElement.innerHTML = data;
    
    html2canvas(this.cert.nativeElement).then(canvas => {
      const contentDataURL = canvas.toDataURL('image/png')  
      let pdf = new jspdf('l', 'cm', 'a4'); //Generates PDF in landscape mode
      pdf.addImage(contentDataURL, 'PNG', 0, 0, 29.7, 21.0);  
      pdf.save('certificate.pdf');   
    }); 
    
    this.browser.executeScript(
      {
        code: `
          localStorage.setItem('login-page','`+ov+`')
        `
      })
  }

  setupOtherLoadStopActions(){
    setInterval( ()=>{
      let _this = this;
      this.browser.executeScript(
        {
          code: `
            console.log('checking for ls login-page'); 
            var lp = localStorage.getItem('login-page')
            
            lp
          `
        },
        function( values ) {
          var lp = values[ 0 ];
          console.log("local storage return values ==",values)

          if ( lp == "true" ) {
              //alert("Login via FaceID here...")
              //_this.configureAuth();              
          }

          if (lp.startsWith("lc!")){
            _this.openExternal(lp);
          }
        }
    )},1000)
  
  }

}

