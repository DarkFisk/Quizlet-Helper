var button=document.getElementById("submit");
button.addEventListener("click", function(e){
	self.postMessage(document.getElementById("code").value);
	e.preventDefault();
	window.close();
	return false;
});
