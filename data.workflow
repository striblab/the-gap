; /usr/bin/drake
;
; This file describes and performs the data processing
; workflow using Drake, a Make-like format focused on data.
; https://github.com/Factual/drake
;
; Full documentation (suggested to switch to Viewing mode)
; https://docs.google.com/document/d/1bF-OKNLIG10v_lMes_m4yyaJtAaJKtdK0Jizvi_MNsg/
;
; Suggested groups/tags of tasks:
; Download, Convert, Combine, Analysis, and Export
;
; Run with: drake -w data.workflow
;


; Base directory for all inputs and output
BASE=data


; Download results files.  (At least in 2016) There is not US President by
; state senate results, so we have to use all the precinct data

; State and House
sources/2016-all-by-precinct.csv, %download <- [-timecheck]
  mkdir -p $BASE/sources
  wget -O $OUTPUT "ftp://media:results@ftp.sos.state.mn.us/20161108/allracesbyprecinct.txt"

; House (proxy Gov)
sources/2014-all-by-precinct.csv, %download <- [-timecheck]
  mkdir -p $BASE/sources
  wget -O $OUTPUT "ftp://media:results@ftp.sos.state.mn.us/20141104/allracesbyprecinct.txt"

; State and House
sources/2012-all-by-precinct.csv, %download <- [-timecheck]
  mkdir -p $BASE/sources
  wget -O $OUTPUT "ftp://media:results@ftp.sos.state.mn.us/20121106_SG/allracesbyprecinct.txt"

; State and House
sources/2010-all-by-precinct-legacy.csv, %download <- [-timecheck]
  mkdir -p $BASE/sources
  curl "http://www.sos.state.mn.us/media/1696/2010_general_results_final.xls" | in2csv --format xls > $OUTPUT

; State? and House
sources/2008-all-by-precinct-legacy.csv, %download <- [-timecheck]
  mkdir -p $BASE/sources
  curl "http://www.sos.state.mn.us/media/1695/2008_general_results.xls" | in2csv --format xls > $OUTPUT

; State? and House
sources/2006-all-by-precinct.csv, %download <- [-timecheck]
  mkdir -p $BASE/sources
  wget -O $OUTPUT "http://electionresults.sos.state.mn.us/Results/MediaResult/55?mediafileid=13"

; 2004: http://electionresults.sos.state.mn.us/Select/Download/42
; Doesn't have all by precinct
sources/2004-state-leg.csv, %download <- [-timecheck]
  mkdir -p $BASE/sources
  wget -O $OUTPUT "http://electionresults.sos.state.mn.us/Results/MediaResult/42?mediafileid=20"
sources/2004-president-by-state-leg.csv, %download <- [-timecheck]
  mkdir -p $BASE/sources
  wget -O $OUTPUT "http://electionresults.sos.state.mn.us/Results/MediaResult/42?mediafileid=54"

; 2002: Doesn't have by precinct to match to Gov or other

; 2000: No files?
; http://electionresults.sos.state.mn.us/20001107/

; 1998
sources/1998-all-by-precinct-legacy.csv, %download <- [-timecheck]
  mkdir -p $BASE/sources
  curl "http://www.sos.state.mn.us/media/1918/1998_results.xls" | in2csv --format xls > $OUTPUT

; 1996
sources/1996-all-by-precinct-legacy.csv, %download <- [-timecheck]
  mkdir -p $BASE/sources
  curl "http://www.sos.state.mn.us/media/1976/1996_results.xls" | in2csv --format xls > $OUTPUT



; Processing...



; Cleanup tasks
%sources.cleanup, %cleanup, %WARNING <-
  rm -rv $BASE/sources/*
%build.cleanup, %cleanup, %WARNING <-
  rm -rv $BASE/build/*
