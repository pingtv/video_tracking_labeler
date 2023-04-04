

function WaitDialog(sDialogDivID,sTitle,sMessage)
{    
    
    this.m_sID      = sDialogDivID;
    this.m_sTitle   = sTitle;
    this.m_sMessage = sMessage;
    this.m_bForcehide = false;
    
    WaitDialog.prototype.m_othis = this;  
    
    
    WaitDialog.prototype.init();
    
}


WaitDialog.prototype.init = function()
{
        
    WaitDialog.prototype.set_title(WaitDialog.prototype.m_othis.m_sTitle);
    
    WaitDialog.prototype.set_message(WaitDialog.prototype.m_othis.m_sMessage);
    
    
};

WaitDialog.prototype.set_message = function(sMessage)
{
    
  $('#' + WaitDialog.prototype.m_othis.m_sID + '_' + 'message').html(sMessage);  
    
};

WaitDialog.prototype.set_title = function(sTitle)
{

  $('#' + WaitDialog.prototype.m_othis.m_sID + '_' + 'title').html(sTitle);    
    
};

WaitDialog.prototype.show = function()
{
    WaitDialog.prototype.init();

    let that = this;

    this.m_bForcehide = false;
    
    $('#' + WaitDialog.prototype.m_othis.m_sID).modal({
                                            backdrop: 'static',
                                            keyboard : false,
                                            focus : true
                                       });

    $('#' + WaitDialog.prototype.m_othis.m_sID).on('shown.bs.modal', function() {

       if (that.m_bForcehide)
       {
           that.hide();
       }

    })

};

WaitDialog.prototype.hide = function()
{
    let that = this;

    this.m_bForcehide = true;

   $('#' + WaitDialog.prototype.m_othis.m_sID).modal('hide');

    $('#' + WaitDialog.prototype.m_othis.m_sID).on('hide.bs.modal', function() {

        that.m_bForcehide = false;

    })
           
};


 