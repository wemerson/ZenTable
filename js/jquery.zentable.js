/**
    Zentable v0.9.1 Developed by Zentense (Aug'09)
    Copyright (c) 2009 Jose R. Cabanes
    Copyright (c) 2010 SvenDowideit@fosiki.com
    Dual licensed under the MIT and GPL licenses.
    Needs jquery.timers, Draggable from jquery-ui and jquery.mousewheel
 */

(function($) {

    $.fn.zentable= function(options) {
        var opts = $.extend({}, $.fn.zentable.defaults, options);
       
        return this.each(function() {
            $this = $(this);
            $(this).empty();
            var instance= new $.fn.zentable.Zentable(this.id, opts);
            $.fn.zentable.instance= instance;

            if (opts.onclick)
                instance.onclick= opts.onclick;

            if (opts.onedit) 
                instance.editCallback= opts.onedit;

            var data;
            if (opts.data instanceof Array) {
                data= new $.fn.zentable.ArrayDataSource(opts.data, opts.cols, instance.getRows());
            } else 
            if (opts.data!=undefined) {
                data= new $.fn.zentable.AJAXDataSource(opts.data, instance.getRows());
            }
            instance.setDataSource(data);
            data.setFilters(opts.filters);
            data.setOrder(opts.order);
            for(i=0; i<opts.filters.length; i++) {
                var f= $("#"+opts.filters[i]);

                switch(f.attr("type")) {
                case "text":
                    f.keyup(function() { $(this).oneTime(500, 'filter', instance.data.refresh); });
                    break;
                case "select-one":
                case "checkbox":
                    f.change(function() { instance.data.refresh(); });              
                }

            }
            data.refresh();


        });

    };

    $.fn.zentable.defaults= {        
        cols:[],
        data: undefined,
        hideIfEmpty: true,
        filters: [],
        onclick: false,
        onedit: false,
        order: '',
        rows: 10,
        stylesInRows: false,
        totalsRow: false
    };

    /*********************************************************************************************
                                        ZENTABLE
    *********************************************************************************************/
    $.fn.zentable.Zentable= function(name, opts) {
        this.data= new $.fn.zentable.ArrayDataSource([]);

        var rows= opts.rows;
        var cols= 1;
        var columns= [ {name:'Empty'}];
        var colWidth= new Array();
        var table, field, scroll, overlay, tip, status;
        instance= this;
        var needsScroll= false;
        var dragStart, colWidthStart, usedStart;
        var cells= new Array();
        var editing= null;

        this.setDataSource= function(source) {
            columns= null;
            this.data= source;   
            source.setListener(this);
            scroll.setCurrentRow(0);
            if (opts.hideIfEmpty && source.isDataReady() && source.getSize()==0)
                table.hide();
        };

        function makeEditable() {
            table.find(".row .cell:not(.noteditable)").click(function() {
                editing= $(this);
                editing.parent().children().removeClass("hover");
                overlay.fadeTo(0,0);            
                overlay.show();
                overlay.fadeTo(500, 0.4);       
                field.css("top", editing.position().top);
                field.css("left", editing.position().left);
                var input= field.children().eq(0);
                input.width(editing.width());
                input.get(0).value= editing.html();
                field.fadeIn(250, function() { input.focus(); });
            });
            
        };

        this.endEdit= function() {
            editing= null;
            field.fadeOut(250);
            overlay.fadeOut(500);
        };



        function getWidth() {
            return table.width() - 9 * cols - (instance.data.getSize()>rows ? 20 : 0);	// padding*2 + 1
        };

        this.setColumnWidths= function(w) {
            colWidth= w;
            totColWidth= 0;
            tot= getWidth();

            for (i=0; i<cols; i++)
                if (columns[i].fixedwidth!=null)
                    tot -= columns[i].width;

            for (i=0; i<cols; i++)
                if (columns[i].width==null)
                    totColWidth += w[i];

            for (i=0; i<cols; i++)
                colWidth[i]= columns[i].width!=null  ? columns[i].width : colWidth[i]*tot/totColWidth;
            this.resizeColumns();
        };

        this.refresh= function() {
//TODO: this seems un-necessarily presumtious - shouldn't the datasource decide if it needs a clear - ie, shouldn't this call loadPage?
            this.data.clearCache();
            needsScroll= true;
        };

        this.getRows= function() { return rows; };

        this.dataLoaded= function() {
            var size= this.data.getSize();

            if (columns==null) {
                columns= this.data.cols;  
                cols= columns.length;
                renderCells();
                autoWidth();
            }
            if (size>rows)
                scroll.get().show();
            else
                scroll.get().hide();

            table.find(".row").css("display", "block");          
            table.find(".row:gt("+(size==0 ? 0 : size-1)+")").css("display", "none");    

            var y= table.offset().top + 42;
            status.draggable('option', 'containment', [0, y, 0, Math.min(y+size*table.find(".row").height(), $(window).height()-36)] );    

            scroll.setTotalRows(size);
            
            if (opts.hideIfEmpty) {
                if (this.data.getSize()==0)
                    table.hide();
                else
                    table.show();
            }
       

            needsScroll= true;
        };

        function autoWidth() {
            var widths= new Array();
            var lim= Math.min(rows, instance.data.getSize());

            if (lim==0) {
                for (j=0; j<cols; j++)
                    widths[j]= 1;
            } else {
                for (i=0; i<lim; i++) {
                    var row= instance.data.getRow(i);
                    for (j=0; j<cols; j++) {
                        var len= ($("<span>"+row[j]+"</span>").text()).length + 5;                
                        if (widths[j]==undefined || len>widths[j]) 
                            widths[j]= len;
                    }
                }
            }
            instance.setColumnWidths(widths);
        };

        this.setLoading= function(bool) { 
            var l= status.find("#loading");
            if (bool) l.show();
            else l.fadeOut(250);
        };


        function renderHTML() {
            table= $("#"+name);
            table.height("auto");

            table.append('<div class="overlay"></div>');
            overlay= table.find(".overlay");
            table.append('<div class="tip"></div>');        
            tip= table.find(".tip");        
            table.append('<div class="field"><input type="text"></div>');
            field= table.find(".field");

            table.append('<div id="'+name+'_scroll" class="scroll"></div>');
            scroll= new $.fn.zentable.Scrollbar(name, rows, instance);   
            
            table.append('<div class="headerrow"></div>');
            row= table.find(".headerrow");
            table.append('<div class="rowcontainer"></div>');

            renderCells();
            table.append('<div class="status"><div id="message"></div><div id="loading">LOADING...</div></div>');
            status= table.find(".status");
            instance.setColumnWidths([1]);
        };


        function renderCells() {
            var header= table.find(".headerrow");
            header.empty();
            for (j=0; j<cols; j++) {
                header.append('<div class="header col'+j+(columns[j].orderable ? " orderable" : "")+'">'+columns[j].name+'</div>');
                if (j>0)
                    header.append('<div id="'+name+'_'+j+'RS" ident="'+j+'" class="resize"></div>');
            }

            table.find(".orderable").click(function(){
                for (j=0; j<cols; j++)
                    if ($(this).hasClass("col"+j))
                        instance.data.sort(j);
            });

            var container= table.find(".rowcontainer");
            container.empty();
            for (i=0; i< rows; i++) 
                container.append('<div class="row" row="'+i+'"></div>');

            if (opts.totalsRow) {
                container.append('<div class="totals"></div>');
                for (j=0; j< cols; j++)
                   table.find(".totals").append('<div class="col'+j+'"></div>');
            }
                
            container.find(".row").each(function(i) {
                cells[i]= new Array();

                for (j=0; j< cols; j++) {
                    $(this).append('<div class="cell col'+j+' '+columns[j].clss+(!columns[j].editable ? ' noteditable': '')+'"></div>');
                    cells[i][j]= $(this).find(".cell:last");
                }
                
                $(this).hover(
                    function() { $(this).children().addClass("hover"); },
                    function() { $(this).children().removeClass("hover"); }
                );

            });


            table.find(".resize").draggable({ 
                axis:'x',
                drag: function(event, ui) { instance.resizeColumn(event, ui); },
                start: function(event, ui) { instance.startResizeColumn(event, ui); },
                stop: function(event, ui) { instance.resizeColumns(); }
            });

            table.find(".row .cell, .headerrow .header").hover( 
                function() { 
                    instance.hideTip();            
                    var cell= $(this);
                    table.oneTime(1000, 'tip', function() { instance.showTip(cell); } ); 
                },
                function() { table.stopTime('tip'); }
            );

            if (instance.onclick)
                table.find(".row .noteditable").click(function() {
                    for (x=0; x<cols;x++)
                        if ($(this).hasClass("col"+x)) 
                            break;
                    instance.onclick($(this), x, $(this).parent().attr("row")*1 + scroll.getCurrentRow() );
                });

            if (instance.editCallback)
                makeEditable();
        };


        this.startResizeColumn= function(event, ui) {
            idx= ui.helper.attr("ident") - 1;
            colWidthStart= table.find(".row .col"+idx).width();
            dragStart= ui.helper.offset().left;
        };


        this.resizeColumn= function(event, ui) {
            idx= ui.helper.attr("ident") - 1;

            width= colWidthStart + ui.helper.offset().left - dragStart;
            if (width<20)
                return;

            var used= 0;
            for (i= idx+1; i<cols; i++) 
                used += colWidth[i];

            var avail= getWidth() - width;
            for (i=idx-1; i>=0; i--)
                avail -= colWidth[i];

            for (i= idx+1; i<cols; i++) {
                if (colWidth[i]/used * avail<20)
                    return;
            }
            colWidth[idx]= width;
            for (i= idx+1; i<cols; i++) 
                colWidth[i]= parseInt(colWidth[i]/used * avail);
            this.resizeColumns();
        };


        this.resizeColumns= function(recalculate) {
            totalWidth= getWidth();

            if (recalculate) {
                tmp=0;
                for (i=0; i<cols; i++)
                    tmp += colWidth[i];
                 for (i=0; i<cols; i++)
                    colWidth[i] *= totalWidth/tmp;
            }

            tmp= 0;
            for (j=0; j<cols-1; j++) {
                w= parseInt(colWidth[j]);
//                table.find(".headerrow .col"+j).width(w);
                table.find("* .col"+j).width(w);
                $("#"+name+"_"+j+"RS").css("left", tmp+(9*j)-4+'px');
                tmp += w;
            }
            $("#"+name+"_"+j+"RS").css("left", tmp+(9*j)-4+'px');
//            table.find(".headerrow .col"+j).width(totalWidth - tmp - 0.5);
            table.find("* .col"+j).width(totalWidth - tmp - 0.5);	
        };


        this.scrollChanged= function() {
            needsScroll= true;
        };


        this.scroller= function() {
            if (needsScroll) {
                needsScroll= false;
                var pos= scroll.getCurrentRow();

                for (i=0; i<rows; i++) {
                    var row= instance.data.getRow(i+pos);                
                    for (j=0; j<cols; j++) 
                        cells[i][j].html(row ? ""+row[j] : '');
                }

                if (opts.totalsRow) {
                    table.find(".totals div").each(function(i) {
                        $(this).html(instance.data.totals[i]);
                    });
                }

                if (opts.stylesInRows) {
                    table.find(".row").each(function(i) {
                        $(this).removeClass();
                        $(this).addClass("row "+ instance.data.getRowClass(i + pos));
                    });
                }

                var total= scroll.getTotalRows();
                status.find("#message").html("Viewing "+(rows>total ? total : rows)+" of "+total+" rows. Starting at row "+scroll.getCurrentRow());
            }
        };

        
        this.showTip= function(cell) {
            tip.html(cell.html());
            if (tip.width() > cell.width()*0.9) {;
                tip.css("top", cell.position().top);
                tip.css("left", cell.position().left);
                tip.fadeIn(250);            
            }        
        };

        this.hideTip= function() {
            tip.fadeOut(400, function() { tip.css("left", 0); } );
        };

        this.verticalResize= function() {
            var h= table.find(".row").height();
            rows= parseInt((status.position().top-23 - (opts.totalsRow ? h : 0) ) / h);

            table.find(".scroll").empty();        
            scroll= new $.fn.zentable.Scrollbar(name, rows, instance);
            scroll.setTotalRows(this.data.getSize());

            renderCells();
            this.resizeColumns();
            needsScroll= true;
            status.css("top", "");
            table.css("height", "");
        };


        this.setOrderSign= function(col, ascending) {
            table.find(".ascending,.descending").remove();
            var hdr= table.find(".headerrow .col"+col);
            hdr.append('<div class="'+(ascending ? 'ascending' : 'descending')+'"></div>');
        };

        renderHTML();
        table.find(".row:gt(0)").css("display", "none");            

        $(document).ready(function() {

            $(window).resize(function() { instance.resizeColumns(true); });

            table.mouseleave(function() { instance.hideTip();});
      
//TODO: use tab to accept the edit, and if it's OK, move to the next editable element..
            $(document).keydown(function(e) {
                if (editing!=null) {
                    switch(e.keyCode) {
                        case 13: 
                            for (columnIndex=0; columnIndex<cols;columnIndex++)
                                if (editing.hasClass("col"+columnIndex)) 
                                    break;
                            y= editing.parent().attr("row")*1;
                            var val= field.children().eq(0).get(0).value;
                            var columnName= columns[columnIndex].id==null ? columns[columnIndex].name : columns[columnIndex].id;
                            instance.editCallback(editing, val, columnName, y + scroll.getCurrentRow(), columnIndex );                
                        case 27: instance.endEdit(); break;
                    }           
                    return true;
                }

                switch(e.keyCode) {
                    case 38: scroll.up(); break;
                    case 40: scroll.down(); break;
                    case 33: scroll.pageUp(); break;
                    case 34: scroll.pageDown(); break;
                    case 36: scroll.first(); break;
                    case 35: scroll.last(); break;
                    default: return true;
                }
                return false;
            });
            
            table.mousewheel(function(event, delta) {
                if (editing!=null)
                    return true;
                if (delta>0)
                    scroll.move(-5);
                else
                    scroll.move(5);
                return false;           
            });  
            table.everyTime(60, instance.scroller);           
            overlay.click(instance.endEdit); 

            status.draggable({
                axis:'y',
                grid: [0, 21],
                //revert: true,
                drag: function(event, ui) { table.height(status.position().top + status.height()); },
                stop: function(event, ui) { instance.verticalResize(); }
            });
        });
    };

    /*********************************************************************************************
                                        SCROLLBAR
    *********************************************************************************************/
    $.fn.zentable.Scrollbar= function(name, rows, listener) {
        var widget= $("#"+name+"_scroll");
        widget.append('<div class="buttonup"></div>');
        widget.append('<div class="drag_container"><div class="drag"></div></div>');
        widget.append('<div class="buttondn"></div>'); 
        
        var totalRows= 0;
        var drag= widget.find(".drag");
        var instance= this; 
        var currentRow= 0;
        
        function getHeight() { return widget.height()-45; };
        
        this.get= function() { return widget; };
        this.getCurrentRow= function() { return currentRow; };
        this.setCurrentRow= function(row) { currentRow= row; };

        this.getTotalRows= function() { return totalRows; };
        this.setTotalRows= function(total) {
            totalRows= total;
            widget.find(".drag_container").height(getHeight());        
            drag.height(getHeight()*rows / totalRows);

            if (drag.height()<15) 
                drag.height(15);
        };
        
        this.drag= function(event, ui) {
            var y= drag.position().top;

            var row= parseInt((totalRows - rows) * y / (getHeight() - drag.height()-2));        
            if (row!=currentRow) {
                currentRow= row;
                listener.scrollChanged(row);
            } 
        };
        
        function refresh() {
            setWithinBounds();
            drag.css("top", parseInt( (getHeight() - drag.height()-2)  / (totalRows-rows)*currentRow)+"px");
            listener.scrollChanged(currentRow);
        };

        function setWithinBounds() {
            if (currentRow<0)
                currentRow= 0;        
            if (currentRow>totalRows-rows)
                currentRow=rows>totalRows ? 0 : totalRows-rows;
        };

        this.down= function() {
            currentRow++;
            refresh();
        };

        this.up= function() {   
            currentRow--;
            refresh();
        };
        
        this.pageDown= function() { this.move(rows); };
        this.pageUp= function() { this.move(-rows);};
        this.first= function() { this.move(-currentRow); };
        this.last= function() { this.move(totalRows - rows);};
        this.move= function(delta) {
            currentRow+=delta;
            refresh();
        };
        
        $(document).ready(function() {
            drag.draggable({ 
                axis:'y',
                containment: 'parent',
                drag: function(event, ui) { instance.drag(event, ui); }       
            });
            drag.click(function(){ return false; });
            widget.find(".buttonup").click(function() {instance.up(); });
            widget.find(".buttondn").click(function() {instance.down(); });
            
            widget.find(".drag_container").click(function(e) {
                var y= e.clientY - drag.offset().top - 22; 
                if (y < drag.position().top)
                    instance.pageUp();
                else
                    instance.pageDown();
                return false;
            });
            
        });    
    };

    /*********************************************************************************************
                                        DataSource
    *********************************************************************************************/
    $.fn.zentable.DataSource= function() {
        this.cols= new Array();
        this.totals= new Array();        

        this.setCols= function(cols) { this.cols= cols; };

        this.isDataReady= function() { return true; };

        this.setListener= function() {};
    };

    $.fn.zentable.AJAXDataSource= function(href, pageSize) {
        href= href.indexOf("?")==-1 ? href+"?" : href;
        this.base= $.fn.zentable.DataSource;
        this.base();

        this.order= "";
        cache= new Array();
        this.cacheOrder = '';
        this.cacheContents = '';        //TODO: this should contain the request parameters the cache is already filled with, so we dn't ask for the same thing twice.
        this.rowclasses= new Array();
        this.instance= this;
		var instance= this;
        this.totalRows= 0;
        this.loading= false;
        pageSize== null ? 10 : pageSize;
        this.fields= [];
        this.filters= [];
        this.ready= false;
        this.listener= null;

        this.refresh= function() {
            this.instance.clearCache();
            this.loadPage(0);
        };

        this.setListener= function(l) {
            this.listener= l;
            this.listener.setLoading(this.loading);
        };

        this.setFilters= function(f) { this.filters= f; };

        //TODO: i suspect this is broken unless the ajax data is actually in this order - need to simplify so there is only _one_ way to order the dataset, not 2
        this.setOrder= function(o) { this.order= o; };

        this.clearCache= function() { this.cache= new Array(); };

        this.isDataReady= function() { return this.ready; };

        this.processXML= function(response, stat) {
            var root= response.documentElement;
            this.totalRows= $(response).find("totalrows").text(); 

            var offset= $(response).find("offset").text();
            $(response).find("headers").find("col").each(function(i) { 
                instance.cols[i]= { 
                    name:$(this).text(),
                    id: $(this).attr("id"),
                    html:$(this).attr("html")!=null,
                    width: $(this).attr("width"),
                    editable: $(this).attr("editable")!="false",
                    orderable: $(this).attr("orderable")!="false",
                    clss: $(this).attr("class")==null ? '' : $(this).attr("class")
                };
            });

            $(response).find("row").each(function(i) {
                cache[offset*1+i]= { 
                        values:new Array(), 
                        clss:$(this).attr("class") };
                $(this).find("col").each(function(j) {
                    var t= $(this);
                    var tmp= instance.cols[j].html ? t.text() : t.text().split("<").join("&lt;").split(">").join("&gt;");
                    if (t.attr("link")!=null)
                        tmp= "<a href=\""+t.attr("link")+"\">" + tmp + "</a>";
                    cache[offset*1+i].values[j]= tmp;
                });            
            });

            $(response).find("totals").find("col").each(function(i) {
                instance.totals[i]= $(this).text();
            });

            this.listener.dataLoaded();         
            this.loading= false;     
            this.listener.setLoading(false);       
            this.ready= true;
        };

        this.sort= function(i) {
            var col= this.cols[i].id==null ? this.cols[i].name : this.cols[i].id;
            if (this.order==col)
                this.order= col+" desc";
            else
                this.order= col;
            this.listener.setOrderSign(i, new RegExp (" desc$").test(this.order));
            cache= new Array();
            this.loadPage(0);            
        };

        this.getSize= function() {
            return this.totalRows;
        };

        this.getRow= function(row) {
            if (row<this.getSize() && !cache[row] && !this.loading)
                this.loadPage(row);
            if (cache[row]==null)
                return null;
           return cache[row].values;
        };

        this.getRowClass= function(row) {
            if (cache[row]==null)
                return null;
            return this.cache[row].clss;
        };

        this.set= function(row, col, value) {       
        };

        this.loadPage = function(row) {
            this.loading= true;
            if (this.listener!=null)
                this.listener.setLoading(true);
            var filtSQL= '';
            for (i=0; i<this.filters.length; i++) {                
                var field= $("#"+this.filters[i]);
                var value= "";
                switch (field.attr("type")) {
                case 'select-one':
                case 'hidden':
                case 'text': 
                    value= field.attr("value");
                    break;
                case 'checkbox': 
                    value= field.attr("checked") ? field.attr("value") : "";
                }
                filtSQL += "&"+ this.filters[i] + "=" + value;
            }
            $.ajax({
                type:"GET",
                url: href+"&start="+row+"&pagesize="+this.pageSize+"&order="+this.order+filtSQL,
                dataType: "xml",
                success:function(data, stat) { 
					instance.processXML(data); }
    //            error: function(req, stat, error) { alert(stat+"; "+error); }
             });
        };
    
    };
    $.fn.zentable.ArrayDataSource= function(array, cols, pageSize) {
        this.base= $.fn.zentable.AJAXDataSource;
        this.base('http://yeah.no/really', pageSize);
        
        this.actualArray = array;
        this.cols = cols;

        this.set= function(row, col, value) {
            this.actualArray[row][col]= value;
            this.isDirty = true;        //force a re-sort..
            //TODO: this should call sort, not loadPage?
            this.loadPage(0);
        };

        this.getSize= function() {
            return this.actualArray.length;
        };

        this.setOrder= function(o) { 
            this.order= o; 
            for (var idx=0;idx<this.getSize();idx++) {
                var colName = this.cols[idx].id==null ? this.cols[idx].name : this.cols[idx].id;
                if (colName == this.order) {
                    this.orderColumn = idx;
                    break;
                }
            }
            this.isDirty = true;
        };

        this.sort= function(i) {
            this.orderColumn = i;
            var col= this.cols[i].id==null ? this.cols[i].name : this.cols[i].id;
            if (this.order==col)
                this.order= col+" desc";
            else
                this.order= col;
            this.listener.setOrderSign(i, new RegExp (" desc$").test(this.order));
            //this.cache= new Array();
            //TODO: sort this.actualArray? that sounds like a mistake (tho that is what the ajax one basically does..)
            
            //this.loadPage(0);            
        }
        sortElements = function(a, b) {
            //TODO: frigging heck - the sort function is called in a global context, and I can't work out howto pass a parameter to it
            //          I'd rather not have to eval() to create a custom sort function, but if I can't find a real way, thats what i'll have to do.
            var i = $.fn.zentable.instance.data.orderColumn;
            //reverse sort
            if (new RegExp (" desc$").test($.fn.zentable.instance.data.order)) {
                var t = a;
                a = b;
                b = t;
            }
            //TODO: what about undefined elements?
            //text sort..
            //TODO: um, do the sort with string.toLowerCase()
            return ((a[i] < b[i]) ? -1 : ((a[i] > b[i]) ? 1 : 0));
        }
        this.refresh= function() {
            this.isDirty = true;
            this.loadPage(0);
        };
        this.loadPage = function(row) {
            //return;
            this.loading= true;
            var self = this;
            var offset = 0;
            
            //sorting.
            if ((this.isDirty == true) || (this.order != this.cacheOrder)) {
                self.actualArray.sort(function(a,b) { return sortElements(a, b);});
                this.cacheOrder = this.order;
            }
            
            $(self.actualArray).each(function(i) {
                self.cache[offset*1+i]= { 
                        values:new Array(), 
                        clss:$(this).attr("class") };
                $(this).each(function(j) {
                    var t= $(this);
                    var tmp = this;
//TODO: not sure this is relevant - it looks like the data payload for html/ajax is different from the array one.
//                    var tmp= self.cols[j].html ? t.text() : t.text().split("<").join("&lt;").split(">").join("&gt;");
//                    if (t.attr("link")!=null)
//                        tmp= "<a href=\""+t.attr("link")+"\">" + tmp + "</a>";
                    self.cache[offset*1+i].values[j]= tmp;
                });            
            });

    //        $(response).find("totals").find("col").each(function(i) {
    //            instance.totals[i]= $(this).text();
    //        });
    
   
            this.listener.dataLoaded();         
            this.loading= false;     
            this.listener.setLoading(false);       
            this.ready= true;
            this.isDirty = false;
        }
    };
}) (jQuery);

