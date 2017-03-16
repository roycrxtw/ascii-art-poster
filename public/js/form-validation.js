
$.validate({
	modules : 'location, date, security, file',
	onModulesLoaded : function() {
		$('#country').suggestCountry();
	}
});

