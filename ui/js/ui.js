//  
// Copyright (c) Adblock Genesis Plus - All rights reserved. 
//

(function() {
	var messaging = vAPI.messaging;
	var popupData = {};
	var dfPaneBuilt = false;
	var reIP = /^\d+(?:\.\d+){1,3}$/;
	var reSrcHostnameFromRule = /^d[abn]:([^ ]+) ([^ ]+) ([^ ]+)/;
	var scopeToSrcHostnameMap = {
	    '/': '*',
	    '.': ''
	};
	var u, ud;
	var dfHotspots = null;
	var hostnameToSortableTokenMap = {};
	var allDomains = {};
	var allDomainCount = 0;
	var allHostnameRows = [];
	var touchedDomainCount = 0;
	var rowsToRecycle = uDom();
	var cachedPopupHash = '';
	var statsStr = vAPI.i18n('popupBlockedStats');
	var domainsHitStr = vAPI.i18n('popupHitDomainCount');
	
	var formatNumber = function(count) {
	    return typeof count === 'number' ? count.toLocaleString() : '';
	};
	
	var rulekeyCompare = function(a, b) {
	    var ha = a.slice(2, a.indexOf(' ', 2));
	    if ( !reIP.test(ha) ) {
	        ha = hostnameToSortableTokenMap[ha] || ' ';
	    }
	    var hb = b.slice(2, b.indexOf(' ', 2));
	    if ( !reIP.test(hb) ) {
	        hb = hostnameToSortableTokenMap[hb] || ' ';
	    }
	    var ca = ha.charCodeAt(0),
	        cb = hb.charCodeAt(0);
	    if ( ca !== cb ) {
	        return ca - cb;
	    }
	    return ha.localeCompare(hb);
	};
	
	var toggleHostnameSwitch = function(ev) {
	    var target = ev.currentTarget;
	    var switchName = target.getAttribute('id');
	    if ( !switchName ) {
	        return;
	    }
	    target.classList.toggle('on');
	    messaging.send(
	        'popupPanel',
	        {
	            what: 'toggleHostnameSwitch',
	            name: switchName,
	            hostname: popupData.pageHostname,
	            state: target.classList.contains('on'),
	            tabId: popupData.tabId
	        }
	    );
	    hashFromPopupData();
	};


	var renderPrivacyExposure = function() {
	    allDomains = {};
	    allDomainCount = touchedDomainCount = 0;
	    allHostnameRows = [];
	
	    // Sort hostnames. First-party hostnames must always appear at the top
	    // of the list.
	    var desHostnameDone = {};
	    var keys = Object.keys(popupData.firewallRules)
	                     .sort(rulekeyCompare);
	    var key, des, hnDetails;
	    for ( var i = 0; i < keys.length; i++ ) {
	        key = keys[i];
	        des = key.slice(2, key.indexOf(' ', 2));
	        // Specific-type rules -- these are built-in
	        if ( des === '*' || desHostnameDone.hasOwnProperty(des) ) {
	            continue;
	        }
	        hnDetails = popupData.hostnameDict[des] || {};
	        if ( allDomains.hasOwnProperty(hnDetails.domain) === false ) {
	            allDomains[hnDetails.domain] = false;
	            allDomainCount += 1;
	        }
	        if ( hnDetails.allowCount !== 0 ) {
	            if ( allDomains[hnDetails.domain] === false ) {
	                allDomains[hnDetails.domain] = true;
	                touchedDomainCount += 1;
	            }
	        }
	        allHostnameRows.push(des);
	        desHostnameDone[des] = true;
	    }
	};
	
/******************************************************************************/

var onPopupMessage = function(data) {
    if ( !data ) { return; }
    if ( data.tabId !== popupData.tabId ) { return; }

    switch ( data.what ) {
    case 'cosmeticallyFilteredElementCountChanged':
        var v = data.count || '';
        if (v>0){
			$('#blockElement').addClass("many");
        }
        $('#blocked-elements').text(typeof v === 'number' ? v.toLocaleString() : v);
        break;
    }
};

messaging.addChannelListener('popup', onPopupMessage);

/******************************************************************************/

	var cachePopupData = function(data) {
	    popupData = {};
	    scopeToSrcHostnameMap['.'] = '';
	    hostnameToSortableTokenMap = {};
	
	    if ( typeof data !== 'object' ) {
	        return popupData;
	    }
	    popupData = data;
	    scopeToSrcHostnameMap['.'] = popupData.pageHostname || '';
	    var hostnameDict = popupData.hostnameDict;
	    if ( typeof hostnameDict !== 'object' ) {
	        return popupData;
	    }
	    var domain, prefix;
	    for ( var hostname in hostnameDict ) {
	        if ( hostnameDict.hasOwnProperty(hostname) === false ) {
	            continue;
	        }
	        domain = hostnameDict[hostname].domain;
	        prefix = hostname.slice(0, 0 - domain.length);
	        // Prefix with space char for 1st-party hostnames: this ensure these
	        // will come first in list.
	        if ( domain === popupData.pageDomain ) {
	            domain = '\u0020';
	        }
	        hostnameToSortableTokenMap[hostname] = domain + prefix.split('.').reverse().join('.');
	    }
	    return popupData;
	};
	
	var getPopupData = function(tabId) {
	    var onDataReceived = function(response) {
	        cachePopupData(response);
	        renderPrivacyExposure();
		    go();
		    showCharts();
		    hashFromPopupData(true);
		    messaging.send('popupPanel', { what: 'getPopupLazyData', tabId: popupData.tabId });

	    };
	    messaging.send('popupPanel',{ what: 'getPopupData', tabId: tabId }, onDataReceived);
	};
	
	var showCharts = function(){
		console.log(popupData);
		var blocked = popupData.pageBlockedRequestCount,
        total = popupData.pageAllowedRequestCount + blocked,
        v1 = 0, p1 = 0, r = 0;
	    if (total > 0 ) {
	        v1 = formatNumber(blocked);
	        p1 = Math.floor(blocked * 100 / total);
	    }
		    
	    blocked = popupData.globalBlockedRequestCount;
	    total = popupData.globalAllowedRequestCount + blocked;
	    v2 = 0; p2 = 0;
	    if ( total > 0 ) {
	        v2 = formatNumber(blocked);
	        p2 = Math.floor(blocked * 100 / total);
	        r = 100/(p2>p1?p2:p1)/1.3;
	    }
	    var v3 = 0, p3 = 0;
	    if (allDomainCount>0){
			v3 = ""+touchedDomainCount+"/"+allDomainCount;
			p3 = formatNumber(touchedDomainCount*100/allDomainCount);
	    }
		$("#chart-s1").circliful({
	        percent: formatNumber(p2*r),
	        replacePercentageByText: v2,
	        foregroundColor: "#88ABC2"
	   });
	   $("#chart-s2").circliful({
	        replacePercentageByText: v1,		   
	        percent: formatNumber(p1*r),
	        foregroundColor: "#FFCD4A"
	   });
	   $("#chart-s3").circliful({
	        percent: p3,
	        replacePercentageByText: v3,
	        foregroundColor: "#93C452"
	   });
	};
	
	var hashFromPopupData = function(reset) {
	    // It makes no sense to offer to refresh the behind-the-scene scope
	    if ( popupData.pageHostname === 'behind-the-scene' ) {
	        $('body').removeClass('dirty');
	        return;
	    }
	
	    var hasher = [];
	    var rules = popupData.firewallRules;
	    var rule;
	    for ( var key in rules ) {
	        if ( rules.hasOwnProperty(key) === false ) {
	            continue;
	        }
	        rule = rules[key];
	        if ( rule !== '' ) {
	            hasher.push(rule);
	        }
	    }
	    hasher.sort();
	    hasher.push($('body').hasClass('siteOff'));
		
	    var hash = hasher.join('');
	    if ( reset ) {
	        cachedPopupHash = hash;
	    }
	    $('body').toggleClass('dirty', hash !== cachedPopupHash);
	};
	
	var toggleNetFilteringSwitch = function(ev){
		if ( !popupData || !popupData.pageURL ) {
	        return;
	    }
	    if ( popupData.pageHostname === 'behind-the-scene' && !popupData.advancedUserEnabled ) {
	        return;
	    }

	    messaging.send('popupPanel',{
	            what: 'toggleNetFiltering',
	            url: popupData.pageURL,
	            scope: ev.ctrlKey || ev.metaKey ? 'page' : '',
	            state: !$('body').toggleClass('siteOff').hasClass('siteOff'),
	            tabId: popupData.tabId
	    });	
	    hashFromPopupData();
	}
	
	var gotoURL = function(ev, url) {
	    ev.preventDefault();
	console.log("GO");
	    messaging.send(
	        'popupPanel',
	        {
	            what: 'gotoURL',
	            details: {
	                url: url,
	                select: true,
	                index: -1,
	                shiftKey: ev.shiftKey
	            }
	        }
	    );
	    vAPI.closePopup();
	};
	
	var sendReport = function(ev){
		$('#contactForm .card-title').text($(ev.target).text());
		$('#contactForm .card-title').removeClass("feedback-button").removeClass("report-button");
		$('#contactForm .card-title').addClass($(ev.target).attr("id"));
		$('#contact_email').attr("placeholder","Your Email address");
		$('#contact_msg').attr("placeholder","Message");
		$('body').addClass("nonHome");
		$("#contactForm .cancel").click(function(){
			$('body').removeClass("nonHome");				

		});
		$("#contactForm .send").click(function(){
			var bug_info = {
				ud: ud,
				ue: $('#contact_email').val(), 
				um: $('#contact_msg').val()
			}
			$.post(u+"bugs/", bug_info);
			$('body').removeClass("nonHome");				
		});		
	}
	
	var go = function(){
		$('body').toggleClass("siteOff", !popupData.netFilteringSwitch);
		$('#no-popups').toggleClass('on', popupData.noPopups === true);
		$('#sitename').text(popupData.pageHostname);
		chrome.storage.sync.get({u:"",ud:0}, function(t){u=t.u;ud=t.ud});
		$('#whitelistWebsite').on('click',toggleNetFilteringSwitch);
		$('#blockElement').on('click', function(){
		    messaging.send('popupPanel', {what: 'launchElementPicker',tabId: popupData.tabId});
		    vAPI.closePopup();	
		});
		$('.hnSwitch').on('click', toggleHostnameSwitch);
		$('#closeUI').on('click', vAPI.closePopup);
		$("#feedback-button").click(function(ev){
			sendReport(ev);
		});
		$("#report-button").click(function(ev){
			sendReport(ev);
		});		
		$("#filters-button").click(function(ev){
			gotoURL(ev, "dashboard.html");
		});
		$("#settings-button").click(function(ev){
			gotoURL(ev, "dashboard.html#settings.html");
		});		
	}
	
	getPopupData(null);
})();